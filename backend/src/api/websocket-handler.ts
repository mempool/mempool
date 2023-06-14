import logger from '../logger';
import * as WebSocket from 'ws';
import {
  BlockExtended, TransactionExtended, MempoolTransactionExtended, WebsocketResponse,
  OptimizedStatistic, ILoadingIndicators
} from '../mempool.interfaces';
import blocks from './blocks';
import memPool from './mempool';
import backendInfo from './backend-info';
import mempoolBlocks from './mempool-blocks';
import { Common } from './common';
import loadingIndicators from './loading-indicators';
import config from '../config';
import transactionUtils from './transaction-utils';
import rbfCache from './rbf-cache';
import difficultyAdjustment from './difficulty-adjustment';
import feeApi from './fee-api';
import BlocksAuditsRepository from '../repositories/BlocksAuditsRepository';
import BlocksSummariesRepository from '../repositories/BlocksSummariesRepository';
import Audit from './audit';
import { deepClone } from '../utils/clone';
import priceUpdater from '../tasks/price-updater';
import { ApiPrice } from '../repositories/PricesRepository';

class WebsocketHandler {
  private wss: WebSocket.Server | undefined;
  private extraInitProperties = {};

  private numClients = 0;
  private numConnected = 0;
  private numDisconnected = 0;

  private initData: { [key: string]: string } = {};
  private serializedInitData: string = '{}';

  constructor() { }

  setWebsocketServer(wss: WebSocket.Server) {
    this.wss = wss;
  }

  setExtraInitProperties(property: string, value: any) {
    this.extraInitProperties[property] = value;
    this.setInitDataFields(this.extraInitProperties);
  }

  private setInitDataFields(data: { [property: string]: any }): void {
    for (const property of Object.keys(data)) {
      if (data[property] != null) {
        this.initData[property] = JSON.stringify(data[property]);
      } else {
        delete this.initData[property];
      }
    }
    this.serializedInitData = '{'
      + Object.keys(this.initData).map(key => `"${key}": ${this.initData[key]}`).join(', ')
      + '}';
  }

  private updateInitData(): void {
    const _blocks = blocks.getBlocks().slice(-config.MEMPOOL.INITIAL_BLOCKS_AMOUNT);
    const da = difficultyAdjustment.getDifficultyAdjustment();
    this.setInitDataFields({
      'mempoolInfo': memPool.getMempoolInfo(),
      'vBytesPerSecond': memPool.getVBytesPerSecond(),
      'blocks': _blocks,
      'conversions': priceUpdater.getLatestPrices(),
      'mempool-blocks': mempoolBlocks.getMempoolBlocks(),
      'transactions': memPool.getLatestTransactions(),
      'backendInfo': backendInfo.getBackendInfo(),
      'loadingIndicators': loadingIndicators.getLoadingIndicators(),
      'da': da?.previousTime ? da : undefined,
      'fees': feeApi.getRecommendedFee(),
    });
  }

  public getSerializedInitData(): string {
    return this.serializedInitData;
  }

  setupConnectionHandling() {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    this.wss.on('connection', (client: WebSocket) => {
      this.numConnected++;
      client.on('error', logger.info);
      client.on('close', () => {
        this.numDisconnected++;
      });
      client.on('message', async (message: string) => {
        try {
          const parsedMessage: WebsocketResponse = JSON.parse(message);
          const response = {};

          if (parsedMessage.action === 'want') {
            client['want-blocks'] = parsedMessage.data.indexOf('blocks') > -1;
            client['want-mempool-blocks'] = parsedMessage.data.indexOf('mempool-blocks') > -1;
            client['want-live-2h-chart'] = parsedMessage.data.indexOf('live-2h-chart') > -1;
            client['want-stats'] = parsedMessage.data.indexOf('stats') > -1;
          }

          if (parsedMessage && parsedMessage['track-tx']) {
            if (/^[a-fA-F0-9]{64}$/.test(parsedMessage['track-tx'])) {
              client['track-tx'] = parsedMessage['track-tx'];
              const trackTxid = client['track-tx'];
              // Client is telling the transaction wasn't found
              if (parsedMessage['watch-mempool']) {
                const rbfCacheTxid = rbfCache.getReplacedBy(trackTxid);
                if (rbfCacheTxid) {
                  response['txReplaced'] = {
                    txid: rbfCacheTxid,
                  };
                  client['track-tx'] = null;
                } else {
                  // It might have appeared before we had the time to start watching for it
                  const tx = memPool.getMempool()[trackTxid];
                  if (tx) {
                    if (config.MEMPOOL.BACKEND === 'esplora') {
                      response['tx'] = tx;
                    } else {
                      // tx.prevout is missing from transactions when in bitcoind mode
                      try {
                        const fullTx = await transactionUtils.$getMempoolTransactionExtended(tx.txid, true);
                        response['tx'] = fullTx;
                      } catch (e) {
                        logger.debug('Error finding transaction: ' + (e instanceof Error ? e.message : e));
                      }
                    }
                  } else {
                    try {
                      const fullTx = await transactionUtils.$getMempoolTransactionExtended(client['track-tx'], true);
                      response['tx'] = fullTx;
                    } catch (e) {
                      logger.debug('Error finding transaction. ' + (e instanceof Error ? e.message : e));
                      client['track-mempool-tx'] = parsedMessage['track-tx'];
                    }
                  }
                }
              }
              const tx = memPool.getMempool()[trackTxid];
              if (tx && tx.position) {
                response['txPosition'] = {
                  txid: trackTxid,
                  position: tx.position,
                };
              }
            } else {
              client['track-tx'] = null;
            }
          }

          if (parsedMessage && parsedMessage['track-address']) {
            if (/^([a-km-zA-HJ-NP-Z1-9]{26,35}|[a-km-zA-HJ-NP-Z1-9]{80}|[a-z]{2,5}1[ac-hj-np-z02-9]{8,100}|[A-Z]{2,5}1[AC-HJ-NP-Z02-9]{8,100})$/
              .test(parsedMessage['track-address'])) {
              let matchedAddress = parsedMessage['track-address'];
              if (/^[A-Z]{2,5}1[AC-HJ-NP-Z02-9]{8,100}$/.test(parsedMessage['track-address'])) {
                matchedAddress = matchedAddress.toLowerCase();
              }
              client['track-address'] = matchedAddress;
            } else {
              client['track-address'] = null;
            }
          }

          if (parsedMessage && parsedMessage['track-asset']) {
            if (/^[a-fA-F0-9]{64}$/.test(parsedMessage['track-asset'])) {
              client['track-asset'] = parsedMessage['track-asset'];
            } else {
              client['track-asset'] = null;
            }
          }

          if (parsedMessage && parsedMessage['track-mempool-block'] !== undefined) {
            if (Number.isInteger(parsedMessage['track-mempool-block']) && parsedMessage['track-mempool-block'] >= 0) {
              const index = parsedMessage['track-mempool-block'];
              client['track-mempool-block'] = index;
              const mBlocksWithTransactions = mempoolBlocks.getMempoolBlocksWithTransactions();
              response['projected-block-transactions'] = {
                index: index,
                blockTransactions: mBlocksWithTransactions[index]?.transactions || [],
              };
            } else {
              client['track-mempool-block'] = null;
            }
          }

          if (parsedMessage && parsedMessage['track-rbf'] !== undefined) {
            if (['all', 'fullRbf'].includes(parsedMessage['track-rbf'])) {
              client['track-rbf'] = parsedMessage['track-rbf'];
            } else {
              client['track-rbf'] = false;
            }
          }

          if (parsedMessage.action === 'init') {
            if (!this.initData['blocks']?.length || !this.initData['da']) {
              this.updateInitData();
            }
            if (!this.initData['blocks']?.length) {
              return;
            }
            client.send(this.serializedInitData);
          }

          if (parsedMessage.action === 'ping') {
            response['pong'] = true;
          }

          if (parsedMessage['track-donation'] && parsedMessage['track-donation'].length === 22) {
            client['track-donation'] = parsedMessage['track-donation'];
          }

          if (parsedMessage['track-bisq-market']) {
            if (/^[a-z]{3}_[a-z]{3}$/.test(parsedMessage['track-bisq-market'])) {
              client['track-bisq-market'] = parsedMessage['track-bisq-market'];
            } else {
              client['track-bisq-market'] = null;
            }
          }

          if (Object.keys(response).length) {
            client.send(JSON.stringify(response));
          }
        } catch (e) {
          logger.debug('Error parsing websocket message: ' + (e instanceof Error ? e.message : e));
        }
      });
    });
  }

  handleNewDonation(id: string) {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    this.wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }
      if (client['track-donation'] === id) {
        client.send(JSON.stringify({ donationConfirmed: true }));
      }
    });
  }

  handleLoadingChanged(indicators: ILoadingIndicators) {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    this.setInitDataFields({ 'loadingIndicators': indicators });

    const response = JSON.stringify({ loadingIndicators: indicators });
    this.wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }
      client.send(response);
    });
  }

  handleNewConversionRates(conversionRates: ApiPrice) {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    this.setInitDataFields({ 'conversions': conversionRates });

    const response = JSON.stringify({ conversions: conversionRates });
    this.wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }
      client.send(response);
    });
  }

  handleNewStatistic(stats: OptimizedStatistic) {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    this.printLogs();

    const response = JSON.stringify({
      'live-2h-chart': stats
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }

      if (!client['want-live-2h-chart']) {
        return;
      }

      client.send(response);
    });
  }

  async $handleMempoolChange(newMempool: { [txid: string]: MempoolTransactionExtended },
    newTransactions: MempoolTransactionExtended[], deletedTransactions: MempoolTransactionExtended[]): Promise<void> {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    this.printLogs();

    if (config.MEMPOOL.ADVANCED_GBT_MEMPOOL) {
      await mempoolBlocks.$updateBlockTemplates(newMempool, newTransactions, deletedTransactions, true);
    } else {
      mempoolBlocks.updateMempoolBlocks(newMempool, true);
    }

    const mBlocks = mempoolBlocks.getMempoolBlocks();
    const mBlockDeltas = mempoolBlocks.getMempoolBlockDeltas();
    const mempoolInfo = memPool.getMempoolInfo();
    const vBytesPerSecond = memPool.getVBytesPerSecond();
    const rbfTransactions = Common.findRbfTransactions(newTransactions, deletedTransactions);
    const da = difficultyAdjustment.getDifficultyAdjustment();
    memPool.handleRbfTransactions(rbfTransactions);
    const rbfChanges = rbfCache.getRbfChanges();
    let rbfReplacements;
    let fullRbfReplacements;
    if (Object.keys(rbfChanges.trees).length) {
      rbfReplacements = rbfCache.getRbfTrees(false);
      fullRbfReplacements = rbfCache.getRbfTrees(true);
    }
    for (const deletedTx of deletedTransactions) {
      rbfCache.evict(deletedTx.txid);
    }
    memPool.removeFromSpendMap(deletedTransactions);
    memPool.addToSpendMap(newTransactions);
    const recommendedFees = feeApi.getRecommendedFee();

    // update init data
    this.updateInitData();

    // cache serialized objects to avoid stringify-ing the same thing for every client
    const responseCache = { ...this.initData };
    function getCachedResponse(key: string,  data): string {
      if (!responseCache[key]) {
        responseCache[key] = JSON.stringify(data);
      }
      return responseCache[key];
    }

    // pre-compute new tracked outspends
    const outspendCache: { [txid: string]: { [vout: number]: { vin: number, txid: string } } } = {};
    const trackedTxs = new Set<string>();
    this.wss.clients.forEach((client) => {
      if (client['track-tx']) {
        trackedTxs.add(client['track-tx']);
      }
    });
    if (trackedTxs.size > 0) {
      for (const tx of newTransactions) {
        for (let i = 0; i < tx.vin.length; i++) {
          const vin = tx.vin[i];
          if (trackedTxs.has(vin.txid)) {
            if (!outspendCache[vin.txid]) {
              outspendCache[vin.txid] = { [vin.vout]: { vin: i, txid: tx.txid }};
            } else {
              outspendCache[vin.txid][vin.vout] = { vin: i, txid: tx.txid };
            }
          }
        }
      }
    }

    const latestTransactions = newTransactions.slice(0, 6).map((tx) => Common.stripTransaction(tx));

    this.wss.clients.forEach(async (client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }

      const response = {};

      if (client['want-stats']) {
        response['mempoolInfo'] = getCachedResponse('mempoolInfo', mempoolInfo);
        response['vBytesPerSecond'] = getCachedResponse('vBytesPerSecond', vBytesPerSecond);
        response['transactions'] = getCachedResponse('transactions', latestTransactions);
        if (da?.previousTime) {
          response['da'] = getCachedResponse('da', da);
        }
        response['fees'] = getCachedResponse('fees', recommendedFees);
      }

      if (client['want-mempool-blocks']) {
        response['mempool-blocks'] = getCachedResponse('mempool-blocks', mBlocks);
      }

      if (client['track-mempool-tx']) {
        const tx = newTransactions.find((t) => t.txid === client['track-mempool-tx']);
        if (tx) {
          if (config.MEMPOOL.BACKEND !== 'esplora') {
            try {
              const fullTx = await transactionUtils.$getMempoolTransactionExtended(tx.txid, true);
              response['tx'] = JSON.stringify(fullTx);
            } catch (e) {
              logger.debug('Error finding transaction in mempool: ' + (e instanceof Error ? e.message : e));
            }
          } else {
            response['tx'] = JSON.stringify(tx);
          }
          client['track-mempool-tx'] = null;
        }
      }

      if (client['track-address']) {
        const foundTransactions: TransactionExtended[] = [];

        for (const tx of newTransactions) {
          const someVin = tx.vin.some((vin) => !!vin.prevout && vin.prevout.scriptpubkey_address === client['track-address']);
          if (someVin) {
            if (config.MEMPOOL.BACKEND !== 'esplora') {
              try {
                const fullTx = await transactionUtils.$getMempoolTransactionExtended(tx.txid, true);
                foundTransactions.push(fullTx);
              } catch (e) {
                logger.debug('Error finding transaction in mempool: ' + (e instanceof Error ? e.message : e));
              }
            } else {
              foundTransactions.push(tx);
            }
            return;
          }
          const someVout = tx.vout.some((vout) => vout.scriptpubkey_address === client['track-address']);
          if (someVout) {
            if (config.MEMPOOL.BACKEND !== 'esplora') {
              try {
                const fullTx = await transactionUtils.$getMempoolTransactionExtended(tx.txid, true);
                foundTransactions.push(fullTx);
              } catch (e) {
                logger.debug('Error finding transaction in mempool: ' + (e instanceof Error ? e.message : e));
              }
            } else {
              foundTransactions.push(tx);
            }
          }
        }

        if (foundTransactions.length) {
          response['address-transactions'] = JSON.stringify(foundTransactions);
        }
      }

      if (client['track-asset']) {
        const foundTransactions: TransactionExtended[] = [];

        newTransactions.forEach((tx) => {

          if (client['track-asset'] === Common.nativeAssetId) {
            if (tx.vin.some((vin) => !!vin.is_pegin)) {
              foundTransactions.push(tx);
              return;
            }
            if (tx.vout.some((vout) => !!vout.pegout)) {
              foundTransactions.push(tx);
            }
          } else {
            if (tx.vin.some((vin) => !!vin.issuance && vin.issuance.asset_id === client['track-asset'])) {
              foundTransactions.push(tx);
              return;
            }
            if (tx.vout.some((vout) => !!vout.asset && vout.asset === client['track-asset'])) {
              foundTransactions.push(tx);
            }
          }
        });

        if (foundTransactions.length) {
          response['address-transactions'] = JSON.stringify(foundTransactions);
        }
      }

      if (client['track-tx']) {
        const trackTxid = client['track-tx'];
        const outspends = outspendCache[trackTxid];

        if (outspends && Object.keys(outspends).length) {
          response['utxoSpent'] = JSON.stringify(outspends);
        }

        const rbfReplacedBy = rbfCache.getReplacedBy(client['track-tx']);
        if (rbfReplacedBy) {
          response['rbfTransaction'] = JSON.stringify({
            txid: rbfReplacedBy,
          })
        }

        const rbfChange = rbfChanges.map[client['track-tx']];
        if (rbfChange) {
          response['rbfInfo'] = JSON.stringify(rbfChanges.trees[rbfChange]);
        }

        const mempoolTx = newMempool[trackTxid];
        if (mempoolTx && mempoolTx.position) {
          response['txPosition'] = JSON.stringify({
            txid: trackTxid,
            position: mempoolTx.position,
          });
        }
      }

      if (client['track-mempool-block'] >= 0) {
        const index = client['track-mempool-block'];
        if (mBlockDeltas[index]) {
          response['projected-block-transactions'] = getCachedResponse(`projected-block-transactions-${index}`, {
            index: index,
            delta: mBlockDeltas[index],
          });
        }
      }

      if (client['track-rbf'] === 'all' && rbfReplacements) {
        response['rbfLatest'] = getCachedResponse('rbfLatest', rbfReplacements);
      } else if (client['track-rbf'] === 'fullRbf' && fullRbfReplacements) {
        response['rbfLatest'] = getCachedResponse('fullrbfLatest', fullRbfReplacements);
      }

      if (Object.keys(response).length) {
        const serializedResponse = '{'
          + Object.keys(response).map(key => `"${key}": ${response[key]}`).join(', ')
          + '}';
        client.send(serializedResponse);
      }
    });
  }
 
  async handleNewBlock(block: BlockExtended, txIds: string[], transactions: TransactionExtended[]): Promise<void> {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    this.printLogs();

    const _memPool = memPool.getMempool();

    if (config.MEMPOOL.AUDIT) {
      let projectedBlocks;
      let auditMempool = _memPool;
      // template calculation functions have mempool side effects, so calculate audits using
      // a cloned copy of the mempool if we're running a different algorithm for mempool updates
      const separateAudit = config.MEMPOOL.ADVANCED_GBT_AUDIT !== config.MEMPOOL.ADVANCED_GBT_MEMPOOL;
      if (separateAudit) {
        auditMempool = deepClone(_memPool);
        if (config.MEMPOOL.ADVANCED_GBT_AUDIT) {
          projectedBlocks = await mempoolBlocks.$makeBlockTemplates(auditMempool, false);
        } else {
          projectedBlocks = mempoolBlocks.updateMempoolBlocks(auditMempool, false);
        }
      } else {
        projectedBlocks = mempoolBlocks.getMempoolBlocksWithTransactions();
      }

      if (Common.indexingEnabled() && memPool.isInSync()) {
        const { censored, added, fresh, sigop, score, similarity } = Audit.auditBlock(transactions, projectedBlocks, auditMempool);
        const matchRate = Math.round(score * 100 * 100) / 100;

        const stripped = projectedBlocks[0]?.transactions ? projectedBlocks[0].transactions.map((tx) => {
          return {
            txid: tx.txid,
            vsize: tx.vsize,
            fee: tx.fee ? Math.round(tx.fee) : 0,
            value: tx.value,
          };
        }) : [];

        let totalFees = 0;
        let totalWeight = 0;
        for (const tx of stripped) {
          totalFees += tx.fee;
          totalWeight += (tx.vsize * 4);
        }

        BlocksSummariesRepository.$saveTemplate({
          height: block.height,
          template: {
            id: block.id,
            transactions: stripped,
          }
        });

        BlocksAuditsRepository.$saveAudit({
          time: block.timestamp,
          height: block.height,
          hash: block.id,
          addedTxs: added,
          missingTxs: censored,
          freshTxs: fresh,
          sigopTxs: sigop,
          matchRate: matchRate,
          expectedFees: totalFees,
          expectedWeight: totalWeight,
        });

        if (block.extras) {
          block.extras.matchRate = matchRate;
          block.extras.expectedFees = totalFees;
          block.extras.expectedWeight = totalWeight;
          block.extras.similarity = similarity;
        }
      }
    } else if (block.extras) {
      const mBlocks = mempoolBlocks.getMempoolBlocksWithTransactions();
      if (mBlocks?.length && mBlocks[0].transactions) {
        block.extras.similarity = Common.getSimilarity(mBlocks[0], transactions);
      }
    }

    const rbfTransactions = Common.findMinedRbfTransactions(transactions, memPool.getSpendMap());
    memPool.handleMinedRbfTransactions(rbfTransactions);
    memPool.removeFromSpendMap(transactions);

    // Update mempool to remove transactions included in the new block
    for (const txId of txIds) {
      delete _memPool[txId];
      rbfCache.mined(txId);
    }

    if (config.MEMPOOL.ADVANCED_GBT_MEMPOOL) {
      await mempoolBlocks.$makeBlockTemplates(_memPool, true);
    } else {
      mempoolBlocks.updateMempoolBlocks(_memPool, true);
    }
    const mBlocks = mempoolBlocks.getMempoolBlocks();
    const mBlockDeltas = mempoolBlocks.getMempoolBlockDeltas();

    const da = difficultyAdjustment.getDifficultyAdjustment();
    const fees = feeApi.getRecommendedFee();

    // update init data
    this.updateInitData();

    const responseCache = { ...this.initData };
    function getCachedResponse(key, data): string {
      if (!responseCache[key]) {
        responseCache[key] = JSON.stringify(data);
      }
      return responseCache[key];
    }

    const mempoolInfo = memPool.getMempoolInfo();

    this.wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }

      if (!client['want-blocks']) {
        return;
      }

      const response = {};
      response['block'] = getCachedResponse('block', block);
      response['mempoolInfo'] = getCachedResponse('mempoolInfo', mempoolInfo);
      response['da'] = getCachedResponse('da', da?.previousTime ? da : undefined);
      response['fees'] = getCachedResponse('fees', fees);

      if (mBlocks && client['want-mempool-blocks']) {
        response['mempool-blocks'] = getCachedResponse('mempool-blocks', mBlocks);
      }

      if (client['track-tx']) {
        const trackTxid = client['track-tx'];
        if (trackTxid && txIds.indexOf(trackTxid) > -1) {
          response['txConfirmed'] = JSON.stringify(trackTxid);
        } else {
          const mempoolTx = _memPool[trackTxid];
          if (mempoolTx && mempoolTx.position) {
            response['txPosition'] = JSON.stringify({
              txid: trackTxid,
              position: mempoolTx.position,
            });
          }
        }
      }

      if (client['track-address']) {
        const foundTransactions: TransactionExtended[] = [];

        transactions.forEach((tx) => {
          if (tx.vin && tx.vin.some((vin) => !!vin.prevout && vin.prevout.scriptpubkey_address === client['track-address'])) {
            foundTransactions.push(tx);
            return;
          }
          if (tx.vout && tx.vout.some((vout) => vout.scriptpubkey_address === client['track-address'])) {
            foundTransactions.push(tx);
          }
        });

        if (foundTransactions.length) {
          foundTransactions.forEach((tx) => {
            tx.status = {
              confirmed: true,
              block_height: block.height,
              block_hash: block.id,
              block_time: block.timestamp,
            };
          });

          response['block-transactions'] = JSON.stringify(foundTransactions);
        }
      }

      if (client['track-asset']) {
        const foundTransactions: TransactionExtended[] = [];

        transactions.forEach((tx) => {
          if (client['track-asset'] === Common.nativeAssetId) {
            if (tx.vin && tx.vin.some((vin) => !!vin.is_pegin)) {
              foundTransactions.push(tx);
              return;
            }
            if (tx.vout && tx.vout.some((vout) => !!vout.pegout)) {
              foundTransactions.push(tx);
            }
          } else {
            if (tx.vin && tx.vin.some((vin) => !!vin.issuance && vin.issuance.asset_id === client['track-asset'])) {
              foundTransactions.push(tx);
              return;
            }
            if (tx.vout && tx.vout.some((vout) => !!vout.asset && vout.asset === client['track-asset'])) {
              foundTransactions.push(tx);
            }
          }
        });

        if (foundTransactions.length) {
          foundTransactions.forEach((tx) => {
            tx.status = {
              confirmed: true,
              block_height: block.height,
              block_hash: block.id,
              block_time: block.timestamp,
            };
          });

          response['block-transactions'] = JSON.stringify(foundTransactions);
        }
      }

      if (client['track-mempool-block'] >= 0) {
        const index = client['track-mempool-block'];
        if (mBlockDeltas && mBlockDeltas[index]) {
          response['projected-block-transactions'] = getCachedResponse(`projected-block-transactions-${index}`, {
            index: index,
            delta: mBlockDeltas[index],
          });
        }
      }

      const serializedResponse = '{'
        + Object.keys(response).map(key => `"${key}": ${response[key]}`).join(', ')
        + '}';
      client.send(serializedResponse);
    });
  }

  private printLogs(): void {
    if (this.wss) {
      const count = this.wss?.clients?.size || 0;
      const diff = count - this.numClients;
      this.numClients = count;
      logger.debug(`${count} websocket clients | ${this.numConnected} connected | ${this.numDisconnected} disconnected | (${diff >= 0 ? '+' : ''}${diff})`);
      this.numConnected = 0;
      this.numDisconnected = 0;
    }
  }
}

export default new WebsocketHandler();
