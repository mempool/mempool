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
import rbfCache, { ReplacementInfo } from './rbf-cache';
import difficultyAdjustment from './difficulty-adjustment';
import feeApi from './fee-api';
import BlocksAuditsRepository from '../repositories/BlocksAuditsRepository';
import BlocksSummariesRepository from '../repositories/BlocksSummariesRepository';
import Audit from './audit';
import { deepClone } from '../utils/clone';
import priceUpdater from '../tasks/price-updater';
import { ApiPrice } from '../repositories/PricesRepository';
import accelerationApi from './services/acceleration';
import mempool from './mempool';

// valid 'want' subscriptions
const wantable = [
  'blocks',
  'mempool-blocks',
  'live-2h-chart',
  'stats',
];

class WebsocketHandler {
  private wss: WebSocket.Server | undefined;
  private extraInitProperties = {};

  private numClients = 0;
  private numConnected = 0;
  private numDisconnected = 0;

  private socketData: { [key: string]: string } = {};
  private serializedInitData: string = '{}';
  private lastRbfSummary: ReplacementInfo | null = null;

  constructor() { }

  setWebsocketServer(wss: WebSocket.Server) {
    this.wss = wss;
  }

  setExtraInitData(property: string, value: any) {
    this.extraInitProperties[property] = value;
    this.updateSocketDataFields(this.extraInitProperties);
  }

  private updateSocketDataFields(data: { [property: string]: any }): void {
    for (const property of Object.keys(data)) {
      if (data[property] != null) {
        this.socketData[property] = JSON.stringify(data[property]);
      } else {
        delete this.socketData[property];
      }
    }
    this.serializedInitData = '{'
    + Object.keys(this.socketData).map(key => `"${key}": ${this.socketData[key]}`).join(', ')
    + '}';
  }

  private updateSocketData(): void {
    const _blocks = blocks.getBlocks().slice(-config.MEMPOOL.INITIAL_BLOCKS_AMOUNT);
    const da = difficultyAdjustment.getDifficultyAdjustment();
    this.updateSocketDataFields({
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

    this.wss.on('connection', (client: WebSocket, req) => {
      this.numConnected++;
      client['remoteAddress'] = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      client.on('error', (e) => {
        logger.info(`websocket client error from ${client['remoteAddress']}: ` + (e instanceof Error ? e.message : e));
        client.close();
      });
      client.on('close', () => {
        this.numDisconnected++;
      });
      client.on('message', async (message: string) => {
        try {
          const parsedMessage: WebsocketResponse = JSON.parse(message);
          const response = {};

          const wantNow = {};
          if (parsedMessage && parsedMessage.action === 'want' && Array.isArray(parsedMessage.data)) {
            for (const sub of wantable) {
              const key = `want-${sub}`;
              const wants = parsedMessage.data.includes(sub);
              if (wants && client['wants'] && !client[key]) {
                wantNow[key] = true;
              }
              client[key] = wants;
            }
            client['wants'] = true;
          }

          // send initial data when a client first starts a subscription
          if (wantNow['want-blocks'] || (parsedMessage && parsedMessage['refresh-blocks'])) {
            response['blocks'] = this.socketData['blocks'];
          }

          if (wantNow['want-mempool-blocks']) {
            response['mempool-blocks'] = this.socketData['mempool-blocks'];
          }

          if (wantNow['want-stats']) {
            response['mempoolInfo'] = this.socketData['mempoolInfo'];
            response['vBytesPerSecond'] = this.socketData['vBytesPerSecond'];
            response['fees'] = this.socketData['fees'];
            response['da'] = this.socketData['da'];
          }

          if (parsedMessage && parsedMessage['track-tx']) {
            if (/^[a-fA-F0-9]{64}$/.test(parsedMessage['track-tx'])) {
              client['track-tx'] = parsedMessage['track-tx'];
              const trackTxid = client['track-tx'];
              // Client is telling the transaction wasn't found
              if (parsedMessage['watch-mempool']) {
                const rbfCacheTxid = rbfCache.getReplacedBy(trackTxid);
                if (rbfCacheTxid) {
                  response['txReplaced'] = JSON.stringify({
                    txid: rbfCacheTxid,
                  });
                  client['track-tx'] = null;
                } else {
                  // It might have appeared before we had the time to start watching for it
                  const tx = memPool.getMempool()[trackTxid];
                  if (tx) {
                    if (config.MEMPOOL.BACKEND === 'esplora') {
                      response['tx'] = JSON.stringify(tx);
                    } else {
                      // tx.prevout is missing from transactions when in bitcoind mode
                      try {
                        const fullTx = await transactionUtils.$getMempoolTransactionExtended(tx.txid, true);
                        response['tx'] = JSON.stringify(fullTx);
                      } catch (e) {
                        logger.debug('Error finding transaction: ' + (e instanceof Error ? e.message : e));
                      }
                    }
                  } else {
                    try {
                      const fullTx = await transactionUtils.$getMempoolTransactionExtended(client['track-tx'], true);
                      response['tx'] = JSON.stringify(fullTx);
                    } catch (e) {
                      logger.debug('Error finding transaction. ' + (e instanceof Error ? e.message : e));
                      client['track-mempool-tx'] = parsedMessage['track-tx'];
                    }
                  }
                }
              }
              const tx = memPool.getMempool()[trackTxid];
              if (tx && tx.position) {
                const position: { block: number, vsize: number, accelerated?: boolean } = {
                  ...tx.position
                };
                if (tx.acceleration) {
                  position.accelerated = tx.acceleration;
                }
                response['txPosition'] = JSON.stringify({
                  txid: trackTxid,
                  position
                });
              }
            } else {
              client['track-tx'] = null;
            }
          }

          if (parsedMessage && parsedMessage['track-address']) {
            if (/^([a-km-zA-HJ-NP-Z1-9]{26,35}|[a-km-zA-HJ-NP-Z1-9]{80}|[a-z]{2,5}1[ac-hj-np-z02-9]{8,100}|[A-Z]{2,5}1[AC-HJ-NP-Z02-9]{8,100}|04[a-fA-F0-9]{128}|(02|03)[a-fA-F0-9]{64})$/
              .test(parsedMessage['track-address'])) {
              let matchedAddress = parsedMessage['track-address'];
              if (/^[A-Z]{2,5}1[AC-HJ-NP-Z02-9]{8,100}$/.test(parsedMessage['track-address'])) {
                matchedAddress = matchedAddress.toLowerCase();
              }
              if (/^04[a-fA-F0-9]{128}$/.test(parsedMessage['track-address'])) {
                client['track-address'] = '41' + matchedAddress + 'ac';
              } else if (/^(02|03)[a-fA-F0-9]{64}$/.test(parsedMessage['track-address'])) {
                client['track-address'] = '21' + matchedAddress + 'ac';
              } else {
                client['track-address'] = matchedAddress;
              }
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
              response['projected-block-transactions'] = JSON.stringify({
                index: index,
                blockTransactions: mBlocksWithTransactions[index]?.transactions || [],
              });
            } else {
              client['track-mempool-block'] = null;
            }
          }

          if (parsedMessage && parsedMessage['track-rbf'] !== undefined) {
            if (['all', 'fullRbf'].includes(parsedMessage['track-rbf'])) {
              client['track-rbf'] = parsedMessage['track-rbf'];
              response['rbfLatest'] = JSON.stringify(rbfCache.getRbfTrees(parsedMessage['track-rbf'] === 'fullRbf'));
            } else {
              client['track-rbf'] = false;
            }
          }

          if (parsedMessage && parsedMessage['track-rbf-summary'] != null) {
            if (parsedMessage['track-rbf-summary']) {
              client['track-rbf-summary'] = true;
              if (this.socketData['rbfSummary'] != null) {
                response['rbfLatestSummary'] = this.socketData['rbfSummary'];
              }
            } else {
              client['track-rbf-summary'] = false;
            }
          }

          if (parsedMessage.action === 'init') {
            if (!this.socketData['blocks']?.length || !this.socketData['da'] || !this.socketData['backendInfo'] || !this.socketData['conversions']) {
              this.updateSocketData();
            }
            if (!this.socketData['blocks']?.length) {
              return;
            }
            client.send(this.serializedInitData);
          }

          if (parsedMessage.action === 'ping') {
            response['pong'] = JSON.stringify(true);
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
            const serializedResponse = this.serializeResponse(response);
            client.send(serializedResponse);
          }
        } catch (e) {
          logger.debug(`Error parsing websocket message from ${client['remoteAddress']}: ` + (e instanceof Error ? e.message : e));
          client.close();
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

    this.updateSocketDataFields({ 'loadingIndicators': indicators });

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

    this.updateSocketDataFields({ 'conversions': conversionRates });

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

  handleReorg(): void {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    const da = difficultyAdjustment.getDifficultyAdjustment();

    // update init data
    this.updateSocketDataFields({
      'blocks': blocks.getBlocks(),
      'da': da?.previousTime ? da : undefined,
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }

      const response = {};

      if (client['want-blocks']) {
        response['blocks'] = this.socketData['blocks'];
      }
      if (client['want-stats']) {
        response['da'] = this.socketData['da'];
      }

      if (Object.keys(response).length) {
        const serializedResponse = this.serializeResponse(response);
        client.send(serializedResponse);
      }
    });
  }

  async $handleMempoolChange(newMempool: { [txid: string]: MempoolTransactionExtended }, mempoolSize: number,
    newTransactions: MempoolTransactionExtended[], deletedTransactions: MempoolTransactionExtended[], accelerationDelta: string[]): Promise<void> {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    this.printLogs();

    if (config.MEMPOOL.ADVANCED_GBT_MEMPOOL) {
      if (config.MEMPOOL.RUST_GBT) {
        await mempoolBlocks.$rustUpdateBlockTemplates(newMempool, mempoolSize, newTransactions, deletedTransactions, config.MEMPOOL_SERVICES.ACCELERATIONS);
      } else {
        await mempoolBlocks.$updateBlockTemplates(newMempool, newTransactions, deletedTransactions, accelerationDelta, true, config.MEMPOOL_SERVICES.ACCELERATIONS);
      }
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
    let rbfSummary;
    if (Object.keys(rbfChanges.trees).length) {
      rbfReplacements = rbfCache.getRbfTrees(false);
      fullRbfReplacements = rbfCache.getRbfTrees(true);
      rbfSummary = rbfCache.getLatestRbfSummary();
    }

    for (const deletedTx of deletedTransactions) {
      rbfCache.evict(deletedTx.txid);
    }
    memPool.removeFromSpendMap(deletedTransactions);
    memPool.addToSpendMap(newTransactions);
    const recommendedFees = feeApi.getRecommendedFee();

    const latestTransactions = memPool.getLatestTransactions();

    // update init data
    const socketDataFields = {
      'mempoolInfo': mempoolInfo,
      'vBytesPerSecond': vBytesPerSecond,
      'mempool-blocks': mBlocks,
      'transactions': latestTransactions,
      'loadingIndicators': loadingIndicators.getLoadingIndicators(),
      'da': da?.previousTime ? da : undefined,
      'fees': recommendedFees,
    };
    if (rbfSummary) {
      socketDataFields['rbfSummary'] = rbfSummary;
    }
    this.updateSocketDataFields(socketDataFields);

    // cache serialized objects to avoid stringify-ing the same thing for every client
    const responseCache = { ...this.socketData };
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

    // pre-compute address transactions
    const addressCache = this.makeAddressCache(newTransactions);
    const removedAddressCache = this.makeAddressCache(deletedTransactions);

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
        const newTransactions = Array.from(addressCache[client['track-address']]?.values() || []);
        const removedTransactions = Array.from(removedAddressCache[client['track-address']]?.values() || []);
        // txs may be missing prevouts in non-esplora backends
        // so fetch the full transactions now
        const fullTransactions = (config.MEMPOOL.BACKEND !== 'esplora') ? await this.getFullTransactions(newTransactions) : newTransactions;

        if (removedTransactions.length) {
          response['address-removed-transactions'] = JSON.stringify(removedTransactions);
        }
        if (fullTransactions.length) {
          response['address-transactions'] = JSON.stringify(fullTransactions);
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

        const rbfReplacedBy = rbfChanges.map[client['track-tx']] ? rbfCache.getReplacedBy(client['track-tx']) : false;
        if (rbfReplacedBy) {
          response['rbfTransaction'] = JSON.stringify({
            txid: rbfReplacedBy,
          });
        }

        const rbfChange = rbfChanges.map[client['track-tx']];
        if (rbfChange) {
          response['rbfInfo'] = JSON.stringify(rbfChanges.trees[rbfChange]);
        }

        const mempoolTx = newMempool[trackTxid];
        if (mempoolTx && mempoolTx.position) {
          const positionData = {
            txid: trackTxid,
            position: {
              ...mempoolTx.position,
              accelerated: mempoolTx.acceleration || undefined,
            }
          };
          if (mempoolTx.cpfpDirty) {
            positionData['cpfp'] = {
              ancestors: mempoolTx.ancestors,
              bestDescendant: mempoolTx.bestDescendant || null,
              descendants: mempoolTx.descendants || null,
              effectiveFeePerVsize: mempoolTx.effectiveFeePerVsize || null,
              sigops: mempoolTx.sigops,
              adjustedVsize: mempoolTx.adjustedVsize,
              acceleration: mempoolTx.acceleration
            };
          }
          response['txPosition'] = JSON.stringify(positionData);
        }
      }

      if (client['track-mempool-block'] >= 0 && memPool.isInSync()) {
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

      if (client['track-rbf-summary'] && rbfSummary) {
        response['rbfLatestSummary'] = getCachedResponse('rbfLatestSummary', rbfSummary);
      }

      if (Object.keys(response).length) {
        const serializedResponse = this.serializeResponse(response);
        client.send(serializedResponse);
      }
    });
  }
 
  async handleNewBlock(block: BlockExtended, txIds: string[], transactions: MempoolTransactionExtended[]): Promise<void> {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    this.printLogs();

    const _memPool = memPool.getMempool();

    const rbfTransactions = Common.findMinedRbfTransactions(transactions, memPool.getSpendMap());
    memPool.handleMinedRbfTransactions(rbfTransactions);
    memPool.removeFromSpendMap(transactions);

    if (config.MEMPOOL.AUDIT && memPool.isInSync()) {
      let projectedBlocks;
      let auditMempool = _memPool;
      const isAccelerated = config.MEMPOOL_SERVICES.ACCELERATIONS && accelerationApi.isAcceleratedBlock(block, Object.values(mempool.getAccelerations()));
      // template calculation functions have mempool side effects, so calculate audits using
      // a cloned copy of the mempool if we're running a different algorithm for mempool updates
      const separateAudit = config.MEMPOOL.ADVANCED_GBT_AUDIT !== config.MEMPOOL.ADVANCED_GBT_MEMPOOL;
      if (separateAudit) {
        auditMempool = deepClone(_memPool);
        if (config.MEMPOOL.ADVANCED_GBT_AUDIT) {
          if (config.MEMPOOL.RUST_GBT) {
            projectedBlocks = await mempoolBlocks.$oneOffRustBlockTemplates(auditMempool, isAccelerated, block.extras.pool.id);
          } else {
            projectedBlocks = await mempoolBlocks.$makeBlockTemplates(auditMempool, false, isAccelerated, block.extras.pool.id);
          }
        } else {
          projectedBlocks = mempoolBlocks.updateMempoolBlocks(auditMempool, false);
        }
      } else {
        if ((config.MEMPOOL_SERVICES.ACCELERATIONS)) {
          if (config.MEMPOOL.RUST_GBT) {
            projectedBlocks = await mempoolBlocks.$rustUpdateBlockTemplates(auditMempool, Object.keys(auditMempool).length, [], [], isAccelerated, block.extras.pool.id);
          } else {
            projectedBlocks = await mempoolBlocks.$makeBlockTemplates(auditMempool, false, isAccelerated, block.extras.pool.id);
          }
        } else {
          projectedBlocks = mempoolBlocks.getMempoolBlocksWithTransactions();
        }
      }

      if (Common.indexingEnabled()) {
        const { censored, added, fresh, sigop, fullrbf, accelerated, score, similarity } = Audit.auditBlock(transactions, projectedBlocks, auditMempool);
        const matchRate = Math.round(score * 100 * 100) / 100;

        const stripped = projectedBlocks[0]?.transactions ? projectedBlocks[0].transactions : [];

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
          fullrbfTxs: fullrbf,
          acceleratedTxs: accelerated,
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

    // Update mempool to remove transactions included in the new block
    for (const txId of txIds) {
      delete _memPool[txId];
      rbfCache.mined(txId);
    }

    if (config.MEMPOOL.ADVANCED_GBT_MEMPOOL) {
      if (config.MEMPOOL.RUST_GBT) {
        await mempoolBlocks.$rustUpdateBlockTemplates(_memPool, Object.keys(_memPool).length, [], transactions, true);
      } else {
        await mempoolBlocks.$makeBlockTemplates(_memPool, true, config.MEMPOOL_SERVICES.ACCELERATIONS);
      }
    } else {
      mempoolBlocks.updateMempoolBlocks(_memPool, true);
    }
    const mBlocks = mempoolBlocks.getMempoolBlocks();
    const mBlockDeltas = mempoolBlocks.getMempoolBlockDeltas();

    const da = difficultyAdjustment.getDifficultyAdjustment();
    const fees = feeApi.getRecommendedFee();
    const mempoolInfo = memPool.getMempoolInfo();

    // pre-compute address transactions
    const addressCache = this.makeAddressCache(transactions);

    // update init data
    this.updateSocketDataFields({
      'mempoolInfo': mempoolInfo,
      'blocks': [...blocks.getBlocks(), block].slice(-config.MEMPOOL.INITIAL_BLOCKS_AMOUNT),
      'mempool-blocks': mBlocks,
      'loadingIndicators': loadingIndicators.getLoadingIndicators(),
      'da': da?.previousTime ? da : undefined,
      'fees': fees,
    });

    const responseCache = { ...this.socketData };
    function getCachedResponse(key, data): string {
      if (!responseCache[key]) {
        responseCache[key] = JSON.stringify(data);
      }
      return responseCache[key];
    }

    this.wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }

      const response = {};

      if (client['want-blocks']) {
        response['block'] = getCachedResponse('block', block);
      }

      if (client['want-stats']) {
        response['mempoolInfo'] = getCachedResponse('mempoolInfo', mempoolInfo);
        response['vBytesPerSecond'] = getCachedResponse('vBytesPerSecond', memPool.getVBytesPerSecond());
        response['fees'] = getCachedResponse('fees', fees);

        if (da?.previousTime) {
          response['da'] = getCachedResponse('da', da);
        }
      }

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
              position: {
                ...mempoolTx.position,
                accelerated: mempoolTx.acceleration || undefined,
              }
            });
          }
        }
      }

      if (client['track-address']) {
        const foundTransactions: TransactionExtended[] = Array.from(addressCache[client['track-address']]?.values() || []);

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

      if (client['track-mempool-block'] >= 0 && memPool.isInSync()) {
        const index = client['track-mempool-block'];
        if (mBlockDeltas && mBlockDeltas[index]) {
          response['projected-block-transactions'] = getCachedResponse(`projected-block-transactions-${index}`, {
            index: index,
            delta: mBlockDeltas[index],
          });
        }
      }

      if (Object.keys(response).length) {
        const serializedResponse = this.serializeResponse(response);
        client.send(serializedResponse);
      }
    });
  }

  // takes a dictionary of JSON serialized values
  // and zips it together into a valid JSON object
  private serializeResponse(response): string {
    return '{'
        + Object.keys(response).map(key => `"${key}": ${response[key]}`).join(', ')
        + '}';
  }

  private makeAddressCache(transactions: MempoolTransactionExtended[]): { [address: string]: Set<MempoolTransactionExtended> } {
    const addressCache: { [address: string]: Set<MempoolTransactionExtended> } = {};
    for (const tx of transactions) {
      for (const vin of tx.vin) {
        if (vin?.prevout?.scriptpubkey_address) {
          if (!addressCache[vin.prevout.scriptpubkey_address]) {
            addressCache[vin.prevout.scriptpubkey_address] = new Set();
          }
          addressCache[vin.prevout.scriptpubkey_address].add(tx);
        }
        if (vin?.prevout?.scriptpubkey) {
          if (!addressCache[vin.prevout.scriptpubkey]) {
            addressCache[vin.prevout.scriptpubkey] = new Set();
          }
          addressCache[vin.prevout.scriptpubkey].add(tx);
        }
      }
      for (const vout of tx.vout) {
        if (vout?.scriptpubkey_address) {
          if (!addressCache[vout?.scriptpubkey_address]) {
            addressCache[vout?.scriptpubkey_address] = new Set();
          }
          addressCache[vout?.scriptpubkey_address].add(tx);
        }
        if (vout?.scriptpubkey) {
          if (!addressCache[vout.scriptpubkey]) {
            addressCache[vout.scriptpubkey] = new Set();
          }
          addressCache[vout.scriptpubkey].add(tx);
        }
      }
    }
    return addressCache;
  }

  private async getFullTransactions(transactions: MempoolTransactionExtended[]): Promise<MempoolTransactionExtended[]> {
    for (let i = 0; i < transactions.length; i++) {
      try {
        transactions[i] = await transactionUtils.$getMempoolTransactionExtended(transactions[i].txid, true);
      } catch (e) {
        logger.debug('Error finding transaction in mempool: ' + (e instanceof Error ? e.message : e));
      }
    }
    return transactions;
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
