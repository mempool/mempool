const config = require('../mempool-config.json');
import * as fs from 'fs';
import * as express from 'express';
import * as compression from 'compression';
import * as http from 'http';
import * as https from 'https';
import * as WebSocket from 'ws';

import routes from './routes';
import blocks from './api/blocks';
import memPool from './api/mempool';
import mempoolBlocks from './api/mempool-blocks';
import diskCache from './api/disk-cache';
import statistics from './api/statistics';

import { Block, TransactionExtended, Statistic } from './interfaces';

import fiatConversion from './api/fiat-conversion';

class Server {
  private wss: WebSocket.Server;
  private server: https.Server | http.Server;
  private app: any;

  constructor() {
    this.app = express();

    this.app
      .use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        next();
      })
      .use(compression());

    if (config.SSL === true) {
      const credentials = {
        cert: fs.readFileSync(config.SSL_CERT_FILE_PATH),
        key: fs.readFileSync(config.SSL_KEY_FILE_PATH),
      };
      this.server = https.createServer(credentials, this.app);
      this.wss = new WebSocket.Server({ server: this.server });
    } else {
      this.server = http.createServer(this.app);
      this.wss = new WebSocket.Server({ server: this.server });
    }

    this.setUpRoutes();
    this.setUpWebsocketHandling();
    this.setUpMempoolCache();
    this.runMempoolIntervalFunctions();

    statistics.startStatistics();
    fiatConversion.startService();

    this.server.listen(config.HTTP_PORT, () => {
      console.log(`Server started on port ${config.HTTP_PORT}`);
    });
  }

  private async runMempoolIntervalFunctions() {
    await memPool.updateMemPoolInfo();
    await blocks.updateBlocks();
    await memPool.updateMempool();
    setTimeout(this.runMempoolIntervalFunctions.bind(this), config.ELECTRS_POLL_RATE_MS);
  }

  private setUpMempoolCache() {
    const cacheData = diskCache.loadData();
    if (cacheData) {
      memPool.setMempool(JSON.parse(cacheData));
    }

    process.on('SIGINT', (options) => {
      console.log('SIGINT');
      diskCache.saveData(JSON.stringify(memPool.getMempool()));
      process.exit(2);
    });
  }

  private setUpWebsocketHandling() {
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

    statistics.setNewStatisticsEntryCallback((stats: Statistic) => {
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
    });

    blocks.setNewBlockCallback((block: Block, txIds: string[], transactions: TransactionExtended[]) => {
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
            if (tx.vin.some((vin) => vin.prevout.scriptpubkey_address === client['track-address'])) {
              foundTransactions.push(tx);
              return;
            }
            if (tx.vout.some((vout) => vout.scriptpubkey_address === client['track-address'])) {
              foundTransactions.push(tx);
            }
          });

          if (foundTransactions.length) {
            response['address-block-transactions'] = foundTransactions;
          }
        }

        client.send(JSON.stringify(response));
      });
    });

    memPool.setMempoolChangedCallback((newMempool: { [txid: string]: TransactionExtended }, newTransactions: TransactionExtended[]) => {
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
    });
  }

  private setUpRoutes() {
    this.app
      .get(config.API_ENDPOINT + 'fees/recommended', routes.getRecommendedFees)
      .get(config.API_ENDPOINT + 'fees/mempool-blocks', routes.getMempoolBlocks)
      .get(config.API_ENDPOINT + 'statistics/2h', routes.get2HStatistics)
      .get(config.API_ENDPOINT + 'statistics/24h', routes.get24HStatistics.bind(routes))
      .get(config.API_ENDPOINT + 'statistics/1w', routes.get1WHStatistics.bind(routes))
      .get(config.API_ENDPOINT + 'statistics/1m', routes.get1MStatistics.bind(routes))
      .get(config.API_ENDPOINT + 'statistics/3m', routes.get3MStatistics.bind(routes))
      .get(config.API_ENDPOINT + 'statistics/6m', routes.get6MStatistics.bind(routes))
      .get(config.API_ENDPOINT + 'statistics/1y', routes.get1YStatistics.bind(routes))
      ;
    }
}

const server = new Server();
