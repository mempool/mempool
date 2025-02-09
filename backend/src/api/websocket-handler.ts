import logger from '../logger';
import * as WebSocket from 'ws';
import {
  BlockExtended, TransactionExtended, MempoolTransactionExtended, WebsocketResponse,
  OptimizedStatistic, ILoadingIndicators, GbtCandidates, TxTrackingInfo,
  MempoolDelta, MempoolDeltaTxids
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
import BlocksRepository from '../repositories/BlocksRepository';
import BlocksAuditsRepository from '../repositories/BlocksAuditsRepository';
import BlocksSummariesRepository from '../repositories/BlocksSummariesRepository';
import Audit from './audit';
import priceUpdater from '../tasks/price-updater';
import { ApiPrice } from '../repositories/PricesRepository';
import { Acceleration } from './services/acceleration';
import accelerationApi from './services/acceleration';
import mempool from './mempool';
import statistics from './statistics/statistics';
import accelerationRepository from '../repositories/AccelerationRepository';
import bitcoinApi from './bitcoin/bitcoin-api-factory';
import walletApi from './services/wallets';

interface AddressTransactions {
  mempool: MempoolTransactionExtended[],
  confirmed: MempoolTransactionExtended[],
  removed: MempoolTransactionExtended[],
}
import bitcoinSecondClient from './bitcoin/bitcoin-second-client';
import { calculateMempoolTxCpfp } from './cpfp';
import { getRecentFirstSeen } from '../utils/file-read';
import stratumApi, { StratumJob } from './services/stratum';

// valid 'want' subscriptions
const wantable = [
  'blocks',
  'mempool-blocks',
  'live-2h-chart',
  'stats',
  'tomahawk',
];

class WebsocketHandler {
  private webSocketServers: WebSocket.Server[] = [];
  private extraInitProperties = {};

  private numClients = 0;
  private numConnected = 0;
  private numDisconnected = 0;

  private socketData: { [key: string]: string } = {};
  private serializedInitData: string = '{}';
  private lastRbfSummary: ReplacementInfo[] | null = null;
  private mempoolSequence: number = 0;

  private accelerations: Record<string, Acceleration> = {};

  constructor() { }

  addWebsocketServer(wss: WebSocket.Server) {
    this.webSocketServers.push(wss);
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
      'backend': config.MEMPOOL.BACKEND,
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
    if (!this.webSocketServers.length) {
      throw new Error('No WebSocket.Server have been set');
    }

    // TODO - Fix indentation after PR is merged
    for (const server of this.webSocketServers) {
    server.on('connection', (client: WebSocket, req) => {
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
              if (wants && !client[key]) {
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

          if (wantNow['want-tomahawk']) {
            response['tomahawk'] = JSON.stringify(bitcoinApi.getHealthStatus());
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
                  position,
                  accelerationPositions: memPool.getAccelerationPositions(tx.txid),
                });
              }
            } else {
              client['track-tx'] = null;
            }
          }

          if (parsedMessage && parsedMessage['track-txs']) {
            const txids: string[] = [];
            if (Array.isArray(parsedMessage['track-txs'])) {
              for (const txid of parsedMessage['track-txs']) {
                if (/^[a-fA-F0-9]{64}$/.test(txid)) {
                  txids.push(txid);
                }
              }
            }

            const txs: { [txid: string]: TxTrackingInfo } = {};
            for (const txid of txids) {
              const txInfo: TxTrackingInfo = {
                confirmed: true,
              };
              const rbfCacheTxid = rbfCache.getReplacedBy(txid);
              if (rbfCacheTxid) {
                txInfo.replacedBy = rbfCacheTxid;
                txInfo.confirmed = false;
              }
              const tx = memPool.getMempool()[txid];
              if (tx && tx.position) {
                txInfo.position = {
                  ...tx.position
                };
                if (tx.acceleration) {
                  txInfo.accelerated = tx.acceleration;
                }
              }
              if (tx) {
                txInfo.confirmed = false;
              }
              txs[txid] = txInfo;
            }

            if (txids.length) {
              client['track-txs'] = txids;
            } else {
              client['track-txs'] = null;
            }

            if (Object.keys(txs).length) {
              response['tracked-txs'] = JSON.stringify(txs);
            }
          }

          if (parsedMessage && parsedMessage['track-address']) {
            const validAddress = this.testAddress(parsedMessage['track-address']);
            if (validAddress) {
              client['track-address'] = validAddress;
            } else {
              client['track-address'] = null;
            }
          }

          if (parsedMessage && parsedMessage['track-addresses'] && Array.isArray(parsedMessage['track-addresses'])) {
            const addressMap: { [address: string]: string } = {};
            for (const address of parsedMessage['track-addresses']) {
              const validAddress = this.testAddress(address);
              if (validAddress) {
                addressMap[address] = validAddress;
              }
            }
            if (Object.keys(addressMap).length > config.MEMPOOL.MAX_TRACKED_ADDRESSES) {
              response['track-addresses-error'] = `"too many addresses requested, this connection supports tracking a maximum of ${config.MEMPOOL.MAX_TRACKED_ADDRESSES} addresses"`;
              client['track-addresses'] = null;
            } else if (Object.keys(addressMap).length > 0) {
              client['track-addresses'] = addressMap;
            } else {
              client['track-addresses'] = null;
            }
          }

          if (parsedMessage && parsedMessage['track-scriptpubkeys'] && Array.isArray(parsedMessage['track-scriptpubkeys'])) {
            const spks: string[] = [];
            for (const spk of parsedMessage['track-scriptpubkeys']) {
              if (/^[a-fA-F0-9]+$/.test(spk)) {
                spks.push(spk.toLowerCase());
              }
            }
            if (spks.length > config.MEMPOOL.MAX_TRACKED_ADDRESSES) {
              response['track-scriptpubkeys-error'] = `"too many scriptpubkeys requested, this connection supports tracking a maximum of ${config.MEMPOOL.MAX_TRACKED_ADDRESSES} scriptpubkeys"`;
              client['track-scriptpubkeys'] = null;
            } else if (spks.length) {
              client['track-scriptpubkeys'] = spks;
            } else {
              client['track-scriptpubkeys'] = null;
            }
          }

          if (parsedMessage && parsedMessage['track-wallet']) {
            if (parsedMessage['track-wallet'] === 'stop') {
              client['track-wallet'] = null;
            } else {
              client['track-wallet'] = parsedMessage['track-wallet'];
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
                sequence: this.mempoolSequence,
                blockTransactions: (mBlocksWithTransactions[index]?.transactions || []).map(mempoolBlocks.compressTx),
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

          if (parsedMessage && parsedMessage['track-accelerations'] != null) {
            if (parsedMessage['track-accelerations']) {
              client['track-accelerations'] = true;
              response['accelerations'] = JSON.stringify({
                accelerations: Object.values(memPool.getAccelerations()),
              });
            } else {
              client['track-accelerations'] = false;
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

          if (parsedMessage['track-mempool-txids'] === true) {
            client['track-mempool-txids'] = true;
          } else if (parsedMessage['track-mempool-txids'] === false) {
            delete client['track-mempool-txids'];
          }

          if (parsedMessage['track-mempool'] === true) {
            client['track-mempool'] = true;
          } else if (parsedMessage['track-mempool'] === false) {
            delete client['track-mempool'];
          }

          if (parsedMessage && parsedMessage['track-stratum'] != null) {
            if (parsedMessage['track-stratum']) {
              const sub = parsedMessage['track-stratum'];
              client['track-stratum'] = sub;
              response['stratumJobs'] = this.socketData['stratumJobs'];
            } else {
              client['track-stratum'] = false;
            }
          }

          if (Object.keys(response).length) {
            client.send(this.serializeResponse(response));
          }
        } catch (e) {
          logger.debug(`Error parsing websocket message from ${client['remoteAddress']}: ` + (e instanceof Error ? e.message : e));
          client.close();
        }
      });
    });
    }
  }

  handleNewDonation(id: string) {
    if (!this.webSocketServers.length) {
      throw new Error('No WebSocket.Server have been set');
    }

    // TODO - Fix indentation after PR is merged
    for (const server of this.webSocketServers) {
    server.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }
      if (client['track-donation'] === id) {
        client.send(JSON.stringify({ donationConfirmed: true }));
      }
    });
    }
  }

  handleLoadingChanged(indicators: ILoadingIndicators) {
    if (!this.webSocketServers.length) {
      throw new Error('No WebSocket.Server have been set');
    }

    this.updateSocketDataFields({ 'loadingIndicators': indicators });

    const response = JSON.stringify({ loadingIndicators: indicators });
    // TODO - Fix indentation after PR is merged
    for (const server of this.webSocketServers) {
    server.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }
      client.send(response);
    });
    }
  }

  handleNewConversionRates(conversionRates: ApiPrice) {
    if (!this.webSocketServers.length) {
      throw new Error('No WebSocket.Server have been set');
    }

    this.updateSocketDataFields({ 'conversions': conversionRates });

    const response = JSON.stringify({ conversions: conversionRates });
    // TODO - Fix indentation after PR is merged
    for (const server of this.webSocketServers) {
    server.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }
      client.send(response);
    });
    }
  }

  handleNewStatistic(stats: OptimizedStatistic) {
    if (!this.webSocketServers.length) {
      throw new Error('No WebSocket.Server have been set');
    }

    this.printLogs();

    const response = JSON.stringify({
      'live-2h-chart': stats
    });

    // TODO - Fix indentation after PR is merged
    for (const server of this.webSocketServers) {
    server.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }

      if (!client['want-live-2h-chart']) {
        return;
      }

      client.send(response);
    });
    }
  }

  handleAccelerationsChanged(accelerations: Record<string, Acceleration>): void {
    if (!this.webSocketServers.length) {
      throw new Error('No WebSocket.Server has been set');
    }

    const websocketAccelerationDelta = accelerationApi.getAccelerationDelta(this.accelerations, accelerations);
    this.accelerations = accelerations;

    if (!websocketAccelerationDelta.length) {
      return;
    }

    // pre-compute acceleration delta
    const accelerationUpdate = {
      added: websocketAccelerationDelta.map(txid => accelerations[txid]).filter(acc => acc != null),
      removed: websocketAccelerationDelta.filter(txid => !accelerations[txid]),
    };

    try {
      const response = JSON.stringify({
        accelerations: accelerationUpdate,
      });

      for (const server of this.webSocketServers) {
        server.clients.forEach((client) => {
          if (client.readyState !== WebSocket.OPEN) {
            return;
          }
          client.send(response);
        });
      }
    } catch (e) {
      logger.debug(`Error sending acceleration update to websocket clients: ${e}`);
    }
  }

  handleReorg(): void {
    if (!this.webSocketServers.length) {
      throw new Error('No WebSocket.Server have been set');
    }

    const da = difficultyAdjustment.getDifficultyAdjustment();

    // update init data
    this.updateSocketDataFields({
      'blocks': blocks.getBlocks(),
      'da': da?.previousTime ? da : undefined,
    });

    // TODO - Fix indentation after PR is merged
    for (const server of this.webSocketServers) {
    server.clients.forEach((client) => {
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
        client.send(this.serializeResponse(response));
      }
    });
    }
  }

  /**
   *
   * @param newMempool
   * @param mempoolSize
   * @param newTransactions  array of transactions added this mempool update.
   * @param recentlyDeletedTransactions array of arrays of transactions removed in the last N mempool updates, most recent first.
   * @param accelerationDelta
   * @param candidates
   */
  async $handleMempoolChange(newMempool: { [txid: string]: MempoolTransactionExtended }, mempoolSize: number,
    newTransactions: MempoolTransactionExtended[], recentlyDeletedTransactions: MempoolTransactionExtended[][], accelerationDelta: string[],
    candidates?: GbtCandidates): Promise<void> {
    if (!this.webSocketServers.length) {
      throw new Error('No WebSocket.Server have been set');
    }

    this.printLogs();

    const deletedTransactions = recentlyDeletedTransactions.length ? recentlyDeletedTransactions[0] : [];

    const transactionIds = (memPool.limitGBT && candidates) ? Object.keys(candidates?.txs || {}) : Object.keys(newMempool);
    let added = newTransactions;
    let removed = deletedTransactions;
    if (memPool.limitGBT) {
      added = candidates?.added || [];
      removed = candidates?.removed || [];
    }

    if (config.MEMPOOL.RUST_GBT) {
      await mempoolBlocks.$rustUpdateBlockTemplates(transactionIds, newMempool, added, removed, candidates, true);
    } else {
      await mempoolBlocks.$updateBlockTemplates(transactionIds, newMempool, added, removed, candidates, accelerationDelta, true, true);
    }

    const mBlocks = mempoolBlocks.getMempoolBlocks();
    const mBlockDeltas = mempoolBlocks.getMempoolBlockDeltas();
    const mempoolInfo = memPool.getMempoolInfo();
    const vBytesPerSecond = memPool.getVBytesPerSecond();
    const rbfTransactions = Common.findRbfTransactions(newTransactions, recentlyDeletedTransactions.flat());
    const da = difficultyAdjustment.getDifficultyAdjustment();
    const accelerations = accelerationApi.getAccelerations();
    memPool.handleRbfTransactions(rbfTransactions);
    const rbfChanges = rbfCache.getRbfChanges();
    let rbfReplacements;
    let fullRbfReplacements;
    let rbfSummary;
    if (Object.keys(rbfChanges.trees).length || !this.lastRbfSummary) {
      rbfReplacements = rbfCache.getRbfTrees(false);
      fullRbfReplacements = rbfCache.getRbfTrees(true);
      rbfSummary = rbfCache.getLatestRbfSummary() || [];
      this.lastRbfSummary = rbfSummary;
    }

    for (const deletedTx of deletedTransactions) {
      rbfCache.evict(deletedTx.txid);
    }
    memPool.removeFromSpendMap(deletedTransactions);
    memPool.addToSpendMap(newTransactions);
    const recommendedFees = feeApi.getRecommendedFee();

    const latestTransactions = memPool.getLatestTransactions();

    if (memPool.isInSync()) {
      this.mempoolSequence++;
    }

    const replacedTransactions: { replaced: string, by: TransactionExtended }[] = [];
    for (const tx of newTransactions) {
      if (rbfTransactions[tx.txid]) {
        for (const replaced of rbfTransactions[tx.txid].replaced) {
          replacedTransactions.push({ replaced: replaced.txid, by: tx });
        }
      }
    }
    const mempoolDeltaTxids: MempoolDeltaTxids = {
      sequence: this.mempoolSequence,
      added: newTransactions.map(tx => tx.txid),
      removed: deletedTransactions.map(tx => tx.txid),
      mined: [],
      replaced: replacedTransactions.map(replacement => ({ replaced: replacement.replaced, by: replacement.by.txid })),
    };
    const mempoolDelta: MempoolDelta = {
      sequence: this.mempoolSequence,
      added: newTransactions,
      removed: deletedTransactions.map(tx => tx.txid),
      mined: [],
      replaced: replacedTransactions,
    };

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
    // TODO - Fix indentation after PR is merged
    for (const server of this.webSocketServers) {
    server.clients.forEach((client) => {
      if (client['track-tx']) {
        trackedTxs.add(client['track-tx']);
      }
      if (client['track-txs']) {
        for (const txid of client['track-txs']) {
          trackedTxs.add(txid);
        }
      }
    });
    }
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

    const websocketAccelerationDelta = accelerationApi.getAccelerationDelta(this.accelerations, accelerations);
    this.accelerations = accelerations;

    // pre-compute acceleration delta
    const accelerationUpdate = {
      added: websocketAccelerationDelta.map(txid => accelerations[txid]).filter(acc => acc != null),
      removed: websocketAccelerationDelta.filter(txid => !accelerations[txid]),
    };

    // TODO - Fix indentation after PR is merged
    for (const server of this.webSocketServers) {
    server.clients.forEach(async (client) => {
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

      if (client['want-tomahawk']) {
        response['tomahawk'] = getCachedResponse('tomahawk', bitcoinApi.getHealthStatus());
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

      if (client['track-addresses']) {
        const addressMap: { [address: string]: AddressTransactions } = {};
        for (const [address, key] of Object.entries(client['track-addresses'] || {})) {
          const newTransactions = Array.from(addressCache[key as string]?.values() || []);
          const removedTransactions = Array.from(removedAddressCache[key as string]?.values() || []);
          // txs may be missing prevouts in non-esplora backends
          // so fetch the full transactions now
          const fullTransactions = (config.MEMPOOL.BACKEND !== 'esplora') ? await this.getFullTransactions(newTransactions) : newTransactions;
          if (fullTransactions?.length) {
            addressMap[address] = {
              mempool: fullTransactions,
              confirmed: [],
              removed: removedTransactions,
            };
          }
        }

        if (Object.keys(addressMap).length > 0) {
          response['multi-address-transactions'] = JSON.stringify(addressMap);
        }
      }

      if (client['track-scriptpubkeys']) {
        const spkMap: { [spk: string]: AddressTransactions } = {};
        for (const spk of client['track-scriptpubkeys'] || []) {
          const newTransactions = Array.from(addressCache[spk as string]?.values() || []);
          const removedTransactions = Array.from(removedAddressCache[spk as string]?.values() || []);
          // txs may be missing prevouts in non-esplora backends
          // so fetch the full transactions now
          const fullTransactions = (config.MEMPOOL.BACKEND !== 'esplora') ? await this.getFullTransactions(newTransactions) : newTransactions;
          if (fullTransactions?.length) {
            spkMap[spk] = {
              mempool: fullTransactions,
              confirmed: [],
              removed: removedTransactions,
            };
          }
        }

        if (Object.keys(spkMap).length > 0) {
          response['multi-scriptpubkey-transactions'] = JSON.stringify(spkMap);
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
              acceleratedBy: mempoolTx.acceleratedBy || undefined,
              acceleratedAt: mempoolTx.acceleratedAt || undefined,
              feeDelta: mempoolTx.feeDelta || undefined,
            },
            accelerationPositions: memPool.getAccelerationPositions(mempoolTx.txid),
          };
          if (!mempoolTx.cpfpChecked && !mempoolTx.acceleration) {
            calculateMempoolTxCpfp(mempoolTx, newMempool);
          }
          if (mempoolTx.cpfpDirty) {
            positionData['cpfp'] = {
              ancestors: mempoolTx.ancestors,
              bestDescendant: mempoolTx.bestDescendant || null,
              descendants: mempoolTx.descendants || null,
              effectiveFeePerVsize: mempoolTx.effectiveFeePerVsize || null,
              sigops: mempoolTx.sigops,
              adjustedVsize: mempoolTx.adjustedVsize,
              acceleration: mempoolTx.acceleration,
            };
          }
          response['txPosition'] = JSON.stringify(positionData);
        }
      }

      if (client['track-txs']) {
        const txids = client['track-txs'];
        const txs: { [txid: string]: TxTrackingInfo } = {};
        for (const txid of txids) {
          const txInfo: TxTrackingInfo = {};
          const outspends = outspendCache[txid];
          if (outspends && Object.keys(outspends).length) {
            txInfo.utxoSpent = outspends;
          }
          const replacedBy = rbfChanges.map[txid] ? rbfCache.getReplacedBy(txid) : false;
          if (replacedBy) {
            txInfo.replacedBy = replacedBy;
          }
          const mempoolTx = newMempool[txid];
          if (mempoolTx && mempoolTx.position) {
            txInfo.position = {
              ...mempoolTx.position,
              accelerated: mempoolTx.acceleration || undefined,
              acceleratedBy: mempoolTx.acceleratedBy || undefined,
              acceleratedAt: mempoolTx.acceleratedAt || undefined,
              feeDelta: mempoolTx.feeDelta || undefined,
            };
            if (!mempoolTx.cpfpChecked) {
              calculateMempoolTxCpfp(mempoolTx, newMempool);
            }
            if (mempoolTx.cpfpDirty) {
              txInfo.cpfp = {
                ancestors: mempoolTx.ancestors,
                bestDescendant: mempoolTx.bestDescendant || null,
                descendants: mempoolTx.descendants || null,
                effectiveFeePerVsize: mempoolTx.effectiveFeePerVsize || null,
                sigops: mempoolTx.sigops,
                adjustedVsize: mempoolTx.adjustedVsize,
              };
            }
          }
          txs[txid] = txInfo;
        }
        if (Object.keys(txs).length) {
          response['tracked-txs'] = JSON.stringify(txs);
        }
      }

      if (client['track-mempool-block'] >= 0 && memPool.isInSync()) {
        const index = client['track-mempool-block'];
        if (mBlockDeltas[index]) {
          response['projected-block-transactions'] = getCachedResponse(`projected-block-transactions-${index}`, {
            index: index,
            sequence: this.mempoolSequence,
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

      if (client['track-mempool-txids']) {
        response['mempool-txids'] = getCachedResponse('mempool-txids', mempoolDeltaTxids);
      }

      if (client['track-mempool']) {
        response['mempool-transactions'] = getCachedResponse('mempool-transactions', mempoolDelta);
      }

      if (client['track-accelerations'] && (accelerationUpdate.added.length || accelerationUpdate.removed.length)) {
        response['accelerations'] = getCachedResponse('accelerations', accelerationUpdate);
      }

      if (Object.keys(response).length) {
        client.send(this.serializeResponse(response));
      }
    });
    }
  }
 
  async handleNewBlock(block: BlockExtended, txIds: string[], transactions: MempoolTransactionExtended[]): Promise<void> {
    if (!this.webSocketServers.length) {
      throw new Error('No WebSocket.Server have been set');
    }

    const blockTransactions = structuredClone(transactions);

    this.printLogs();
    await statistics.runStatistics();

    const _memPool = memPool.getMempool();
    const candidateTxs = await memPool.getMempoolCandidates();
    let candidates: GbtCandidates | undefined = (memPool.limitGBT && candidateTxs) ? { txs: candidateTxs, added: [], removed: [] } : undefined;
    let transactionIds: string[] = (memPool.limitGBT) ? Object.keys(candidates?.txs || {}) : Object.keys(_memPool);

    const accelerations = Object.values(mempool.getAccelerations());
    await accelerationRepository.$indexAccelerationsForBlock(block, accelerations, structuredClone(transactions));

    const rbfTransactions = Common.findMinedRbfTransactions(transactions, memPool.getSpendMap());
    memPool.handleRbfTransactions(rbfTransactions);
    memPool.removeFromSpendMap(transactions);

    if (config.MEMPOOL.AUDIT && memPool.isInSync()) {
      let projectedBlocks;
      const auditMempool = _memPool;
      const isAccelerated = accelerationApi.isAcceleratedBlock(block, Object.values(mempool.getAccelerations()));

      if (config.MEMPOOL.RUST_GBT) {
        const added = memPool.limitGBT ? (candidates?.added || []) : [];
        const removed = memPool.limitGBT ? (candidates?.removed || []) : [];
        projectedBlocks = await mempoolBlocks.$rustUpdateBlockTemplates(transactionIds, auditMempool, added, removed, candidates, isAccelerated, block.extras.pool.id);
      } else {
        projectedBlocks = await mempoolBlocks.$makeBlockTemplates(transactionIds, auditMempool, candidates, false, isAccelerated, block.extras.pool.id);
      }

      if (Common.indexingEnabled()) {
        const { unseen, censored, added, prioritized, fresh, sigop, fullrbf, accelerated, score, similarity } = Audit.auditBlock(block.height, blockTransactions, projectedBlocks, auditMempool);
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
          },
          version: 1,
        });

        BlocksAuditsRepository.$saveAudit({
          version: 1,
          time: block.timestamp,
          height: block.height,
          hash: block.id,
          unseenTxs: unseen,
          addedTxs: added,
          prioritizedTxs: prioritized,
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

    if (config.CORE_RPC.DEBUG_LOG_PATH && block.extras) {
      const firstSeen = getRecentFirstSeen(block.id);
      if (firstSeen) {
        BlocksRepository.$saveFirstSeenTime(block.id, firstSeen);
        block.extras.firstSeen = firstSeen;
      }
    }

    const confirmedTxids: { [txid: string]: boolean } = {};

    // Update mempool to remove transactions included in the new block
    for (const txId of txIds) {
      delete _memPool[txId];
      rbfCache.mined(txId);
      confirmedTxids[txId] = true;
    }

    if (memPool.limitGBT) {
      const minFeeMempool = memPool.limitGBT ? await bitcoinSecondClient.getRawMemPool() : null;
      const minFeeTip = memPool.limitGBT ? await bitcoinSecondClient.getBlockCount() : -1;
      candidates = await memPool.getNextCandidates(minFeeMempool, minFeeTip, transactions);
      transactionIds = Object.keys(candidates?.txs || {});
    } else {
      candidates = undefined;
      transactionIds = Object.keys(memPool.getMempool());
    }


    if (config.MEMPOOL.RUST_GBT) {
      const added = memPool.limitGBT ? (candidates?.added || []) : [];
      const removed = memPool.limitGBT ? (candidates?.removed || []) : transactions;
      await mempoolBlocks.$rustUpdateBlockTemplates(transactionIds, _memPool, added, removed, candidates, true);
    } else {
      await mempoolBlocks.$makeBlockTemplates(transactionIds, _memPool, candidates, true, true);
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

    const mBlocksWithTransactions = mempoolBlocks.getMempoolBlocksWithTransactions();

    if (memPool.isInSync()) {
      this.mempoolSequence++;
    }

    const replacedTransactions: { replaced: string, by: TransactionExtended }[] = [];
    for (const txid of Object.keys(rbfTransactions)) {
      for (const replaced of rbfTransactions[txid].replaced) {
        replacedTransactions.push({ replaced: replaced.txid, by: rbfTransactions[txid].replacedBy });
      }
    }
    const mempoolDeltaTxids: MempoolDeltaTxids = {
      sequence: this.mempoolSequence,
      added: [],
      removed: [],
      mined: transactions.map(tx => tx.txid),
      replaced: replacedTransactions.map(replacement => ({ replaced: replacement.replaced, by: replacement.by.txid })),
    };
    const mempoolDelta: MempoolDelta = {
      sequence: this.mempoolSequence,
      added: [],
      removed: [],
      mined: transactions.map(tx => tx.txid),
      replaced: replacedTransactions,
    };

    // check for wallet transactions
    const walletTransactions = config.WALLETS.ENABLED ? walletApi.processBlock(block, transactions) : [];

    const responseCache = { ...this.socketData };
    function getCachedResponse(key, data): string {
      if (!responseCache[key]) {
        responseCache[key] = JSON.stringify(data);
      }
      return responseCache[key];
    }

    // TODO - Fix indentation after PR is merged
    for (const server of this.webSocketServers) {
    server.clients.forEach((client) => {
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

      if (client['want-tomahawk']) {
        response['tomahawk'] = getCachedResponse('tomahawk', bitcoinApi.getHealthStatus());
      }

      if (client['track-tx']) {
        const trackTxid = client['track-tx'];
        if (trackTxid && confirmedTxids[trackTxid]) {
          response['txConfirmed'] = JSON.stringify(trackTxid);
        } else {
          const mempoolTx = _memPool[trackTxid];
          if (mempoolTx && mempoolTx.position) {
            response['txPosition'] = JSON.stringify({
              txid: trackTxid,
              position: {
                ...mempoolTx.position,
                accelerated: mempoolTx.acceleration || undefined,
                acceleratedBy: mempoolTx.acceleratedBy || undefined,
                acceleratedAt: mempoolTx.acceleratedAt || undefined,
                feeDelta: mempoolTx.feeDelta || undefined,
              },
              accelerationPositions: memPool.getAccelerationPositions(mempoolTx.txid),
            });
          }
        }
      }

      if (client['track-txs']) {
        const txs: { [txid: string]: TxTrackingInfo } = {};
        for (const txid of client['track-txs']) {
          if (confirmedTxids[txid]) {
            txs[txid] = { confirmed: true };
          } else {
            const mempoolTx = _memPool[txid];
            if (mempoolTx && mempoolTx.position) {
              txs[txid] = {
                position: {
                  ...mempoolTx.position,
                },
                accelerated: mempoolTx.acceleration || undefined,
                acceleratedBy: mempoolTx.acceleratedBy || undefined,
                acceleratedAt: mempoolTx.acceleratedAt || undefined,
                feeDelta: mempoolTx.feeDelta || undefined,
              };
            }
          }
        }
        if (Object.keys(txs).length) {
          response['tracked-txs'] = JSON.stringify(txs);
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

      if (client['track-addresses']) {
        const addressMap: { [address: string]: AddressTransactions } = {};
        for (const [address, key] of Object.entries(client['track-addresses'] || {})) {
          const fullTransactions = Array.from(addressCache[key as string]?.values() || []);
          if (fullTransactions?.length) {
            addressMap[address] = {
              mempool: [],
              confirmed: fullTransactions,
              removed: [],
            };
          }
        }

        if (Object.keys(addressMap).length > 0) {
          response['multi-address-transactions'] = JSON.stringify(addressMap);
        }
      }

      if (client['track-scriptpubkeys']) {
        const spkMap: { [spk: string]: AddressTransactions } = {};
        for (const spk of client['track-scriptpubkeys'] || []) {
          const fullTransactions = Array.from(addressCache[spk as string]?.values() || []);
          if (fullTransactions?.length) {
            spkMap[spk] = {
              mempool: [],
              confirmed: fullTransactions,
              removed: [],
            };
          }
        }

        if (Object.keys(spkMap).length > 0) {
          response['multi-scriptpubkey-transactions'] = JSON.stringify(spkMap);
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

        if (mBlockDeltas && mBlockDeltas[index] && mBlocksWithTransactions[index]?.transactions?.length) {
          if (mBlockDeltas[index].added.length > (mBlocksWithTransactions[index]?.transactions.length / 2)) {
            response['projected-block-transactions'] = getCachedResponse(`projected-block-transactions-full-${index}`, {
              index: index,
              sequence: this.mempoolSequence,
              blockTransactions: mBlocksWithTransactions[index].transactions.map(mempoolBlocks.compressTx),
            });
          } else {
            response['projected-block-transactions'] = getCachedResponse(`projected-block-transactions-delta-${index}`, {
              index: index,
              sequence: this.mempoolSequence,
              delta: mBlockDeltas[index],
            });
          }
        }
      }

      if (client['track-mempool-txids']) {
        response['mempool-txids'] = getCachedResponse('mempool-txids', mempoolDeltaTxids);
      }

      if (client['track-mempool']) {
        response['mempool-transactions'] = getCachedResponse('mempool-transactions', mempoolDelta);
      }

      if (client['track-wallet']) {
        const trackedWallet = client['track-wallet'];
        response['wallet-transactions'] = getCachedResponse(`wallet-transactions-${trackedWallet}`, walletTransactions[trackedWallet] ?? {});
      }

      if (Object.keys(response).length) {
        client.send(this.serializeResponse(response));
      }
    });
    }

    await statistics.runStatistics();
  }

  public handleNewStratumJob(job: StratumJob): void {
    this.updateSocketDataFields({ 'stratumJobs': stratumApi.getJobs() });

    for (const server of this.webSocketServers) {
      server.clients.forEach((client) => {
        if (client.readyState !== WebSocket.OPEN) {
          return;
        }
        if (client['track-stratum'] && (client['track-stratum'] === 'all' || client['track-stratum'] === job.pool)) {
          client.send(JSON.stringify({
            'stratumJob': job
        }));
        }
      });
    }
  }

  // takes a dictionary of JSON serialized values
  // and zips it together into a valid JSON object
  private serializeResponse(response): string {
    return '{'
        + Object.keys(response).filter(key => response[key] != null).map(key => `"${key}": ${response[key]}`).join(', ')
        + '}';
  }

  // checks if an address conforms to a valid format
  // returns the canonical form:
  //  - lowercase for bech32(m)
  //  - lowercase scriptpubkey for P2PK
  // or false if invalid
  private testAddress(address): string | false {
    if (/^([a-km-zA-HJ-NP-Z1-9]{26,35}|[a-km-zA-HJ-NP-Z1-9]{80}|[a-z]{2,5}1[ac-hj-np-z02-9]{8,100}|[A-Z]{2,5}1[AC-HJ-NP-Z02-9]{8,100}|04[a-fA-F0-9]{128}|(02|03)[a-fA-F0-9]{64})$/.test(address)) {
      if (/^[A-Z]{2,5}1[AC-HJ-NP-Z02-9]{8,100}|04[a-fA-F0-9]{128}|(02|03)[a-fA-F0-9]{64}$/.test(address)) {
        address = address.toLowerCase();
      }
      if (/^04[a-fA-F0-9]{128}$/.test(address)) {
        return '41' + address + 'ac';
      } else if (/^(02|03)[a-fA-F0-9]{64}$/.test(address)) {
        return '21' + address + 'ac';
      } else {
        return address;
      }
    } else {
      return false;
    }
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
    if (this.webSocketServers.length) {
      let numTxSubs = 0;
      let numTxsSubs = 0;
      let numProjectedSubs = 0;
      let numRbfSubs = 0;

      // TODO - Fix indentation after PR is merged
      for (const server of this.webSocketServers) {
      server.clients.forEach((client) => {
        if (client['track-tx']) {
          numTxSubs++;
        }
        if (client['track-txs']) {
          numTxsSubs++;
        }
        if (client['track-mempool-block'] != null && client['track-mempool-block'] >= 0) {
          numProjectedSubs++;
        }
        if (client['track-rbf']) {
          numRbfSubs++;
        }
      })
      }

      let count = 0;
      for (const server of this.webSocketServers) {
        count += server.clients?.size || 0;
      }
      const diff = count - this.numClients;
      this.numClients = count;
      logger.debug(`${count} websocket clients | ${this.numConnected} connected | ${this.numDisconnected} disconnected | (${diff >= 0 ? '+' : ''}${diff})`);
      logger.debug(`websocket subscriptions: track-tx: ${numTxSubs}, track-txs: ${numTxsSubs}, track-mempool-block: ${numProjectedSubs} track-rbf: ${numRbfSubs}`);
      this.numConnected = 0;
      this.numDisconnected = 0;
    }
  }
}

export default new WebsocketHandler();
