import logger from '../logger';
import * as WebSocket from 'ws';
import {
  BlockExtended, TransactionExtended, WebsocketResponse, MempoolBlock, MempoolBlockDelta,
  OptimizedStatistic, ILoadingIndicators, IConversionRates
} from '../mempool.interfaces';
import blocks from './blocks';
import memPool from './mempool';
import backendInfo from './backend-info';
import mempoolBlocks from './mempool-blocks';
import fiatConversion from './fiat-conversion';
import { Common } from './common';
import loadingIndicators from './loading-indicators';
import config from '../config';
import transactionUtils from './transaction-utils';
import rbfCache from './rbf-cache';
import difficultyAdjustment from './difficulty-adjustment';
import feeApi from './fee-api';
import BlocksAuditsRepository from '../repositories/BlocksAuditsRepository';
import BlocksSummariesRepository from '../repositories/BlocksSummariesRepository';

class WebsocketHandler {
  private wss: WebSocket.Server | undefined;
  private extraInitProperties = {};

  constructor() { }

  setWebsocketServer(wss: WebSocket.Server) {
    this.wss = wss;
  }

  setExtraInitProperties(property: string, value: any) {
    this.extraInitProperties[property] = value;
  }

  setupConnectionHandling() {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    this.wss.on('connection', (client: WebSocket) => {
      client.on('error', logger.info);
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
              // Client is telling the transaction wasn't found
              if (parsedMessage['watch-mempool']) {
                const rbfCacheTx = rbfCache.get(client['track-tx']);
                if (rbfCacheTx) {
                  response['txReplaced'] = {
                    txid: rbfCacheTx.txid,
                  };
                  client['track-tx'] = null;
                } else {
                  // It might have appeared before we had the time to start watching for it
                  const tx = memPool.getMempool()[client['track-tx']];
                  if (tx) {
                    if (config.MEMPOOL.BACKEND === 'esplora') {
                      response['tx'] = tx;
                    } else {
                      // tx.prevout is missing from transactions when in bitcoind mode
                      try {
                        const fullTx = await transactionUtils.$getTransactionExtended(tx.txid, true);
                        response['tx'] = fullTx;
                      } catch (e) {
                        logger.debug('Error finding transaction: ' + (e instanceof Error ? e.message : e));
                      }
                    }
                  } else {
                    try {
                      const fullTx = await transactionUtils.$getTransactionExtended(client['track-tx'], true);
                      response['tx'] = fullTx;
                    } catch (e) {
                      logger.debug('Error finding transaction. ' + (e instanceof Error ? e.message : e));
                      client['track-mempool-tx'] = parsedMessage['track-tx'];
                    }
                  }
                }
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

          if (parsedMessage.action === 'init') {
            const _blocks = blocks.getBlocks().slice(-config.MEMPOOL.INITIAL_BLOCKS_AMOUNT);
            if (!_blocks) {
              return;
            }
            client.send(JSON.stringify(this.getInitData(_blocks)));
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

    this.wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }
      client.send(JSON.stringify({ loadingIndicators: indicators }));
    });
  }

  handleNewConversionRates(conversionRates: IConversionRates) {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    this.wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }
      client.send(JSON.stringify({ conversions: conversionRates }));
    });
  }

  getInitData(_blocks?: BlockExtended[]) {
    if (!_blocks) {
      _blocks = blocks.getBlocks().slice(-config.MEMPOOL.INITIAL_BLOCKS_AMOUNT);
    }
    return {
      'mempoolInfo': memPool.getMempoolInfo(),
      'vBytesPerSecond': memPool.getVBytesPerSecond(),
      'blocks': _blocks,
      'conversions': fiatConversion.getConversionRates(),
      'mempool-blocks': mempoolBlocks.getMempoolBlocks(),
      'transactions': memPool.getLatestTransactions(),
      'backendInfo': backendInfo.getBackendInfo(),
      'loadingIndicators': loadingIndicators.getLoadingIndicators(),
      'da': difficultyAdjustment.getDifficultyAdjustment(),
      'fees': feeApi.getRecommendedFee(),
      ...this.extraInitProperties
    };
  }

  handleNewStatistic(stats: OptimizedStatistic) {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    this.wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }

      if (!client['want-live-2h-chart']) {
        return;
      }

      client.send(JSON.stringify({
        'live-2h-chart': stats
      }));
    });
  }

  handleMempoolChange(newMempool: { [txid: string]: TransactionExtended },
    newTransactions: TransactionExtended[], deletedTransactions: TransactionExtended[]) {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    mempoolBlocks.updateMempoolBlocks(newMempool);
    const mBlocks = mempoolBlocks.getMempoolBlocks();
    const mBlockDeltas = mempoolBlocks.getMempoolBlockDeltas();
    const mempoolInfo = memPool.getMempoolInfo();
    const vBytesPerSecond = memPool.getVBytesPerSecond();
    const rbfTransactions = Common.findRbfTransactions(newTransactions, deletedTransactions);
    const da = difficultyAdjustment.getDifficultyAdjustment();
    memPool.handleRbfTransactions(rbfTransactions);
    const recommendedFees = feeApi.getRecommendedFee();

    this.wss.clients.forEach(async (client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }

      const response = {};

      if (client['want-stats']) {
        response['mempoolInfo'] = mempoolInfo;
        response['vBytesPerSecond'] = vBytesPerSecond;
        response['transactions'] = newTransactions.slice(0, 6).map((tx) => Common.stripTransaction(tx));
        response['da'] = da;
        response['fees'] = recommendedFees;
      }

      if (client['want-mempool-blocks']) {
        response['mempool-blocks'] = mBlocks;
      }

      if (client['track-mempool-tx']) {
        const tx = newTransactions.find((t) => t.txid === client['track-mempool-tx']);
        if (tx) {
          if (config.MEMPOOL.BACKEND !== 'esplora') {
            try {
              const fullTx = await transactionUtils.$getTransactionExtended(tx.txid, true);
              response['tx'] = fullTx;
            } catch (e) {
              logger.debug('Error finding transaction in mempool: ' + (e instanceof Error ? e.message : e));
            }
          } else {
            response['tx'] = tx;
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
                const fullTx = await transactionUtils.$getTransactionExtended(tx.txid, true);
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
                const fullTx = await transactionUtils.$getTransactionExtended(tx.txid, true);
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
          response['address-transactions'] = foundTransactions;
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
          response['address-transactions'] = foundTransactions;
        }
      }

      if (client['track-tx']) {
        const outspends: object = {};
        newTransactions.forEach((tx) => tx.vin.forEach((vin, i) => {
          if (vin.txid === client['track-tx']) {
            outspends[vin.vout] = {
              vin: i,
              txid: tx.txid,
            };
          }
        }));

        if (Object.keys(outspends).length) {
          response['utxoSpent'] = outspends;
        }

        if (rbfTransactions[client['track-tx']]) {
          for (const rbfTransaction in rbfTransactions) {
            if (client['track-tx'] === rbfTransaction) {
              response['rbfTransaction'] = {
                txid: rbfTransactions[rbfTransaction].txid,
              };
              break;
            }
          }
        }
      }

      if (client['track-mempool-block'] >= 0) {
        const index = client['track-mempool-block'];
        if (mBlockDeltas[index]) {
          response['projected-block-transactions'] = {
            index: index,
            delta: mBlockDeltas[index],
          };
        }
      }

      if (Object.keys(response).length) {
        client.send(JSON.stringify(response));
      }
    });
  }

  handleNewBlock(block: BlockExtended, txIds: string[], transactions: TransactionExtended[]) {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    let mBlocks: undefined | MempoolBlock[];
    let mBlockDeltas: undefined | MempoolBlockDelta[];
    let matchRate = 0;
    const _memPool = memPool.getMempool();
    const _mempoolBlocks = mempoolBlocks.getMempoolBlocksWithTransactions();

    if (_mempoolBlocks[0]) {
      const matches: string[] = [];
      const added: string[] = [];
      const missing: string[] = [];

      for (const txId of txIds) {
        if (_mempoolBlocks[0].transactionIds.indexOf(txId) > -1) {
          matches.push(txId);
        } else {
          added.push(txId);
        }
        delete _memPool[txId];
      }

      for (const txId of _mempoolBlocks[0].transactionIds) {
        if (matches.includes(txId) || added.includes(txId)) {
          continue;
        }
        missing.push(txId);
      }

      matchRate = Math.round((Math.max(0, matches.length - missing.length - added.length) / txIds.length * 100) * 100) / 100;
      mempoolBlocks.updateMempoolBlocks(_memPool);
      mBlocks = mempoolBlocks.getMempoolBlocks();
      mBlockDeltas = mempoolBlocks.getMempoolBlockDeltas();

      if (Common.indexingEnabled()) {
        const stripped = _mempoolBlocks[0].transactions.map((tx) => {
          return {
            txid: tx.txid,
            vsize: tx.vsize,
            fee: tx.fee ? Math.round(tx.fee) : 0,
            value: tx.value,
          };
        });  
        BlocksSummariesRepository.$saveSummary(block.height, null, {
          id: block.id,
          transactions: stripped
        });

        BlocksAuditsRepository.$saveAudit({
          time: block.timestamp,
          height: block.height,
          hash: block.id,
          addedTxs: added,
          missingTxs: missing,
          matchRate: matchRate,
        });
      }
    }

    if (block.extras) {
      block.extras.matchRate = matchRate;
    }

    const da = difficultyAdjustment.getDifficultyAdjustment();
    const fees = feeApi.getRecommendedFee();

    this.wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }

      if (!client['want-blocks']) {
        return;
      }

      const response = {
        'block': block,
        'mempoolInfo': memPool.getMempoolInfo(),
        'da': da,
        'fees': fees,
      };

      if (mBlocks && client['want-mempool-blocks']) {
        response['mempool-blocks'] = mBlocks;
      }

      if (client['track-tx'] && txIds.indexOf(client['track-tx']) > -1) {
        response['txConfirmed'] = true;
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

          response['block-transactions'] = foundTransactions;
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

          response['block-transactions'] = foundTransactions;
        }
      }

      if (client['track-mempool-block'] >= 0) {
        const index = client['track-mempool-block'];
        if (mBlockDeltas && mBlockDeltas[index]) {
          response['projected-block-transactions'] = {
            index: index,
            delta: mBlockDeltas[index],
          };
        }
      }

      client.send(JSON.stringify(response));
    });
  }
}

export default new WebsocketHandler();
