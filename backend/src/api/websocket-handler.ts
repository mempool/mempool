const config = require('../../mempool-config.json');

import * as WebSocket from 'ws';
import { Block, TransactionExtended, WebsocketResponse, MempoolBlock, OptimizedStatistic } from '../interfaces';
import blocks from './blocks';
import memPool from './mempool';
import backendInfo from './backend-info';
import mempoolBlocks from './mempool-blocks';
import fiatConversion from './fiat-conversion';
import { Common } from './common';

class WebsocketHandler {
  private wss: WebSocket.Server | undefined;
  private nativeAssetId = '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';
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
      client.on('message', (message: string) => {
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
              // Client is telling the transaction wasn't found but it might have appeared before we had the time to start watching for it
              if (parsedMessage['watch-mempool']) {
                const tx = memPool.getMempool()[client['track-tx']];
                if (tx) {
                  response['tx'] = tx;
                } else {
                  client['track-mempool-tx'] = parsedMessage['track-tx'];
                }
              }
            } else {
              client['track-tx'] = null;
            }
          }

          if (parsedMessage && parsedMessage['track-address']) {
            if (/^([a-km-zA-HJ-NP-Z1-9]{26,35}|[a-km-zA-HJ-NP-Z1-9]{80}|[a-z]{2,5}1[ac-hj-np-z02-9]{8,87})$/
              .test(parsedMessage['track-address'])) {
              client['track-address'] = parsedMessage['track-address'];
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

          if (parsedMessage.action === 'init') {
            const _blocks = blocks.getBlocks();
            if (!_blocks) {
              return;
            }
            client.send(JSON.stringify({
              'mempoolInfo': memPool.getMempoolInfo(),
              'vBytesPerSecond': memPool.getVBytesPerSecond(),
              'lastDifficultyAdjustment': blocks.getLastDifficultyAdjustmentTime(),
              'blocks': _blocks.slice(Math.max(_blocks.length - config.INITIAL_BLOCK_AMOUNT, 0)),
              'conversions': fiatConversion.getTickers()['BTCUSD'],
              'mempool-blocks': mempoolBlocks.getMempoolBlocks(),
              'transactions': memPool.getLatestTransactions(),
              'git-commit': backendInfo.gitCommitHash,
              'hostname': backendInfo.hostname,
              ...this.extraInitProperties
            }));
          }

          if (parsedMessage.action === 'ping') {
            response['pong'] = true;
          }

          if (Object.keys(response).length) {
            client.send(JSON.stringify(response));
          }
        } catch (e) {
          console.log(e);
        }
      });
    });
  }

  handleNewStatistic(stats: OptimizedStatistic) {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    this.wss.clients.forEach((client: WebSocket) => {
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
    const mempoolInfo = memPool.getMempoolInfo();
    const vBytesPerSecond = memPool.getVBytesPerSecond();
    const rbfTransactions = Common.findRbfTransactions(newTransactions, deletedTransactions);

    this.wss.clients.forEach((client: WebSocket) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }

      const response = {};

      if (client['want-stats']) {
        response['mempoolInfo'] = mempoolInfo;
        response['vBytesPerSecond'] = vBytesPerSecond;
        response['transactions'] = newTransactions.slice(0, 6).map((tx) => Common.stripTransaction(tx));
      }

      if (client['want-mempool-blocks']) {
        response['mempool-blocks'] = mBlocks;
      }

      if (client['track-mempool-tx']) {
        const tx = newTransactions.find((t) => t.txid === client['track-mempool-tx']);
        if (tx) {
          response['tx'] = tx;
          client['track-mempool-tx'] = null;
        }
      }

      if (client['track-address']) {
        const foundTransactions: TransactionExtended[] = [];

        newTransactions.forEach((tx) => {
          const someVin = tx.vin.some((vin) => !!vin.prevout && vin.prevout.scriptpubkey_address === client['track-address']);
          if (someVin) {
            foundTransactions.push(tx);
            return;
          }
          const someVout = tx.vout.some((vout) => vout.scriptpubkey_address === client['track-address']);
          if (someVout) {
            foundTransactions.push(tx);
          }
        });

        if (foundTransactions.length) {
          response['address-transactions'] = foundTransactions;
        }
      }

      if (client['track-asset']) {
        const foundTransactions: TransactionExtended[] = [];

        newTransactions.forEach((tx) => {

          if (client['track-asset'] === this.nativeAssetId) {
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

      if (client['track-tx'] && rbfTransactions[client['track-tx']]) {
        for (const rbfTransaction in rbfTransactions) {
          if (client['track-tx'] === rbfTransaction) {
            response['rbfTransaction'] = rbfTransactions[rbfTransaction];
            break;
          }
        }
      }

      if (Object.keys(response).length) {
        client.send(JSON.stringify(response));
      }
    });
  }

  handleNewBlock(block: Block, txIds: string[], transactions: TransactionExtended[]) {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    // Check how many transactions in the new block matches the latest projected mempool block
    // If it's more than 0, recalculate the mempool blocks and send to client in the same update
    let mBlocks: undefined | MempoolBlock[];
    let matchRate = 0;
    const _mempoolBlocks = mempoolBlocks.getMempoolBlocksWithTransactions();
    if (_mempoolBlocks[0]) {
      const matches: string[] = [];
      for (const txId of txIds) {
        if (_mempoolBlocks[0].transactionIds.indexOf(txId) > -1) {
          matches.push(txId);
        }
      }

      matchRate = Math.round((matches.length / (txIds.length - 1)) * 100);
      if (matchRate > 0) {
        const currentMemPool = memPool.getMempool();
        for (const txId of matches) {
          delete currentMemPool[txId];
        }
        mempoolBlocks.updateMempoolBlocks(currentMemPool);
        mBlocks = mempoolBlocks.getMempoolBlocks();
      }
    }

    block.matchRate = matchRate;

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
        'lastDifficultyAdjustment': blocks.getLastDifficultyAdjustmentTime(),
      };

      if (mBlocks && client['want-mempool-blocks']) {
        response['mempool-blocks'] = mBlocks;
      }

      if (client['track-tx'] && txIds.indexOf(client['track-tx']) > -1) {
        client['track-tx'] = null;
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
          if (client['track-asset'] === this.nativeAssetId) {
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

      client.send(JSON.stringify(response));
    });
  }
}

export default new WebsocketHandler();
