import * as WebSocket from 'ws';
import { Block, TransactionExtended, Statistic } from '../interfaces';
import blocks from './blocks';
import memPool from './mempool';
import mempoolBlocks from './mempool-blocks';
import fiatConversion from './fiat-conversion';

class WebsocketHandler {
  private wss: WebSocket.Server | undefined;

  constructor() { }

  setWebsocketServer(wss: WebSocket.Server) {
    this.wss = wss;
  }

  setupConnectionHandling() {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    this.wss.on('connection', (client: WebSocket) => {
      client.on('message', (message: any) => {
        try {
          const parsedMessage = JSON.parse(message);

          if (parsedMessage.action === 'want') {
            client['want-blocks'] = parsedMessage.data.indexOf('blocks') > -1;
            client['want-mempool-blocks'] = parsedMessage.data.indexOf('mempool-blocks') > -1;
            client['want-live-2h-chart'] = parsedMessage.data.indexOf('live-2h-chart') > -1;
            client['want-stats'] = parsedMessage.data.indexOf('stats') > -1;
          }

          if (parsedMessage && parsedMessage['track-tx']) {
            if (/^[a-fA-F0-9]{64}$/.test(parsedMessage['track-tx'])) {
              client['track-tx'] = parsedMessage['track-tx'];
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

          if (parsedMessage.action === 'init') {
            const _blocks = blocks.getBlocks();
            if (!_blocks) {
              return;
            }
            client.send(JSON.stringify({
              'mempoolInfo': memPool.getMempoolInfo(),
              'vBytesPerSecond': memPool.getVBytesPerSecond(),
              'blocks': _blocks,
              'conversions': fiatConversion.getTickers()['BTCUSD'],
              'mempool-blocks': mempoolBlocks.getMempoolBlocks(),
            }));
          }
        } catch (e) {
          console.log(e);
        }
      });
    });
  }

  handleNewStatistic(stats: Statistic) {
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

  handleMempoolChange(newMempool: { [txid: string]: TransactionExtended }, newTransactions: TransactionExtended[]) {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    mempoolBlocks.updateMempoolBlocks(newMempool);
    const mBlocks = mempoolBlocks.getMempoolBlocks();
    const mempoolInfo = memPool.getMempoolInfo();
    const vBytesPerSecond = memPool.getVBytesPerSecond();

    this.wss.clients.forEach((client: WebSocket) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }

      const response = {};

      if (client['want-stats']) {
        response['mempoolInfo'] = mempoolInfo;
        response['vBytesPerSecond'] = vBytesPerSecond;
      }

      if (client['want-mempool-blocks']) {
        response['mempool-blocks'] = mBlocks;
      }

      // Send all new incoming transactions related to tracked address
      if (client['track-address']) {
        const foundTransactions: TransactionExtended[] = [];

        newTransactions.forEach((tx) => {
          const someVin = tx.vin.some((vin) => vin.prevout.scriptpubkey_address === client['track-address']);
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

      if (Object.keys(response).length) {
        client.send(JSON.stringify(response));
      }
    });
  }

  handleNewBlock(block: Block, txIds: string[], transactions: TransactionExtended[]) {
    if (!this.wss) {
      throw new Error('WebSocket.Server is not set');
    }

    this.wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }

      if (!client['want-blocks']) {
        return;
      }

      const response = {
        'block': block
      };

      if (client['track-tx'] && txIds.indexOf(client['track-tx']) > -1) {
        client['track-tx'] = null;
        response['txConfirmed'] = true;
      }

      if (client['track-address']) {
        const foundTransactions: TransactionExtended[] = [];

        transactions.forEach((tx) => {
          if (tx.vin && tx.vin.some((vin) => vin.prevout.scriptpubkey_address === client['track-address'])) {
            foundTransactions.push(tx);
            return;
          }
          if (tx.vout && tx.vout.some((vout) => vout.scriptpubkey_address === client['track-address'])) {
            foundTransactions.push(tx);
          }
        });

        if (foundTransactions.length) {
          response['address-block-transactions'] = foundTransactions;
        }
      }

      client.send(JSON.stringify(response));
    });
  }
}

export default new WebsocketHandler();
