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

import { Block, SimpleTransaction, Statistic } from './interfaces';

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
            client['want-stats'] = parsedMessage.data.indexOf('stats') > -1;
            client['want-live-2h-chart'] = parsedMessage.data.indexOf('live-2h-chart') > -1;
          }

          if (parsedMessage && parsedMessage.txId && /^[a-fA-F0-9]{64}$/.test(parsedMessage.txId)) {
            client['txId'] = parsedMessage.txId;
          }
        } catch (e) {
          console.log(e);
        }
      });

      const _blocks = blocks.getBlocks();
      if (!_blocks) {
        return;
      }
      client.send(JSON.stringify({
        'blocks': _blocks,
        'conversions': fiatConversion.getTickers()['BTCUSD'],
        'mempool-blocks': mempoolBlocks.getMempoolBlocks(),
      }));

    });

    statistics.setNewStatisticsEntryCallback((stats: Statistic) => {
      this.wss.clients.forEach((client: WebSocket) => {
        if (client.readyState !== WebSocket.OPEN) {
          return;
        }

        if (client['want-live-2h-chart']) {
          client.send(JSON.stringify({
            'live-2h-chart': stats
          }));
        }
      });
    });

    blocks.setNewBlockCallback((block: Block, txIds: string[]) => {
      this.wss.clients.forEach((client) => {
        if (client.readyState !== WebSocket.OPEN) {
          return;
        }

        if (client['txId'] && txIds.indexOf(client['txId']) > -1) {
          client['txId'] = null;
          client.send(JSON.stringify({
            'block': block,
            'txConfirmed': true,
          }));
        } else {
          client.send(JSON.stringify({
            'block': block,
          }));
        }
      });
    });

    memPool.setMempoolChangedCallback((newMempool: { [txid: string]: SimpleTransaction }) => {
      mempoolBlocks.updateMempoolBlocks(newMempool);
      const pBlocks = mempoolBlocks.getMempoolBlocks();

      this.wss.clients.forEach((client: WebSocket) => {
        if (client.readyState !== WebSocket.OPEN) {
          return;
        }

        client.send(JSON.stringify({
          'mempool-blocks': pBlocks
        }));
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
