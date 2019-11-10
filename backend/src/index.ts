const config = require('../mempool-config.json');
import * as fs from 'fs';
import * as express from 'express';
import * as compression from 'compression';
import * as http from 'http';
import * as https from 'https';
import * as WebSocket from 'ws';

import bitcoinApi from './api/bitcoin/bitcoin-api-factory';
import diskCache from './api/disk-cache';
import memPool from './api/mempool';
import blocks from './api/blocks';
import projectedBlocks from './api/projected-blocks';
import statistics from './api/statistics';
import { IBlock, IMempool, ITransaction, IMempoolStats } from './interfaces';

import routes from './routes';
import fiatConversion from './api/fiat-conversion';

class MempoolSpace {
  private wss: WebSocket.Server;
  private server: https.Server | http.Server;
  private app: any;

  constructor() {
    this.app = express();
    this.app
      .use((req, res, next)  => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        next();
      })
      .use(compression());
    if (config.ENV === 'dev') {
      this.server = http.createServer(this.app);
      this.wss = new WebSocket.Server({ server: this.server });
    } else {
      const credentials = {
        cert: fs.readFileSync('/etc/letsencrypt/live/mempool.space/fullchain.pem'),
        key: fs.readFileSync('/etc/letsencrypt/live/mempool.space/privkey.pem'),
      };
      this.server = https.createServer(credentials, this.app);
      this.wss = new WebSocket.Server({ server: this.server });
    }

    this.setUpRoutes();
    this.setUpWebsocketHandling();
    this.setUpMempoolCache();
    this.runMempoolIntervalFunctions();

    statistics.startStatistics();
    fiatConversion.startService();

    const opts = {
        host: '127.0.0.1',
        port: 8999
    };
    this.server.listen(opts, () => {
      console.log(`Server started on ${opts.host}:${opts.port}`);
    });
  }

  private async runMempoolIntervalFunctions() {
    await blocks.updateBlocks();
    await memPool.updateMemPoolInfo();
    await memPool.updateMempool();
    setTimeout(this.runMempoolIntervalFunctions.bind(this), config.MEMPOOL_REFRESH_RATE_MS);
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
      let theBlocks = blocks.getBlocks();
      theBlocks = theBlocks.concat([]).splice(theBlocks.length - config.INITIAL_BLOCK_AMOUNT);
      const formatedBlocks = theBlocks.map((b) => blocks.formatBlock(b));

      client.send(JSON.stringify({
        'mempoolInfo': memPool.getMempoolInfo(),
        'blocks': formatedBlocks,
        'projectedBlocks': projectedBlocks.getProjectedBlocks(),
        'txPerSecond': memPool.getTxPerSecond(),
        'vBytesPerSecond': memPool.getVBytesPerSecond(),
        'conversions': fiatConversion.getTickers()['BTCUSD'],
      }));

      client.on('message', async (message: any) => {
        try {
          const parsedMessage = JSON.parse(message);

          if (parsedMessage.action === 'want') {
            client['want-stats'] = parsedMessage.data.indexOf('stats') > -1;
            client['want-blocks'] = parsedMessage.data.indexOf('blocks') > -1;
            client['want-projected-blocks'] = parsedMessage.data.indexOf('projected-blocks') > -1;
            client['want-live-2h-chart'] = parsedMessage.data.indexOf('live-2h-chart') > -1;
          }

          if (parsedMessage.action === 'track-tx' && parsedMessage.txId && /^[a-fA-F0-9]{64}$/.test(parsedMessage.txId)) {
            const tx = await memPool.getRawTransaction(parsedMessage.txId);
            if (tx) {
              console.log('Now tracking: ' + parsedMessage.txId);
              client['trackingTx'] = true;
              client['txId'] = parsedMessage.txId;
              client['tx'] = tx;

              if (tx.blockhash) {
                const currentBlocks = blocks.getBlocks();
                const foundBlock = currentBlocks.find((block) => block.tx && block.tx.some((i: string) => i === parsedMessage.txId));
                if (foundBlock) {
                  console.log('Found block by looking in local cache');
                  client['blockHeight'] = foundBlock.height;
                } else {
                  const theBlock = await bitcoinApi.getBlock(tx.blockhash);
                  if (theBlock) {
                    client['blockHeight'] = theBlock.height;
                  }
                }
              } else {
                client['blockHeight'] = 0;
              }
              client.send(JSON.stringify({
                'projectedBlocks': projectedBlocks.getProjectedBlocks(client['txId']),
                'track-tx': {
                  tracking: true,
                  blockHeight: client['blockHeight'],
                  tx: client['tx'],
                }
              }));
            } else {
              console.log('TX NOT FOUND, NOT TRACKING');
              client['trackingTx'] = false;
              client['blockHeight'] = 0;
              client['tx'] = null;
              client.send(JSON.stringify({
                'track-tx': {
                  tracking: false,
                  blockHeight: 0,
                  message: 'not-found',
                }
              }));
            }
          }
          if (parsedMessage.action === 'stop-tracking-tx') {
            console.log('STOP TRACKING');
            client['trackingTx'] = false;
            client.send(JSON.stringify({
              'track-tx': {
                tracking: false,
                blockHeight: 0,
                message: 'not-found',
              }
            }));
          }
        } catch (e) {
          console.log(e);
        }
      });

      client.on('close', () => {
        client['trackingTx'] = false;
      });
    });

    blocks.setNewBlockCallback((block: IBlock) => {
      const formattedBlocks = blocks.formatBlock(block);

      this.wss.clients.forEach((client) => {
        if (client.readyState !== WebSocket.OPEN) {
          return;
        }

        const response = {};

        if (client['trackingTx'] === true && client['blockHeight'] === 0) {
          if (block.tx.some((tx: ITransaction) => tx === client['txId'])) {
            client['blockHeight'] = block.height;
          }
        }

        response['track-tx'] = {
          tracking: client['trackingTx'] || false,
          blockHeight: client['blockHeight'],
        };

        response['block'] = formattedBlocks;

        client.send(JSON.stringify(response));
      });
    });

    memPool.setMempoolChangedCallback((newMempool: IMempool) => {
      projectedBlocks.updateProjectedBlocks(newMempool);

      const pBlocks = projectedBlocks.getProjectedBlocks();
      const mempoolInfo = memPool.getMempoolInfo();
      const txPerSecond = memPool.getTxPerSecond();
      const vBytesPerSecond = memPool.getVBytesPerSecond();

      this.wss.clients.forEach((client: WebSocket) => {
        if (client.readyState !== WebSocket.OPEN) {
          return;
        }

        const response = {};

        if (client['want-stats']) {
          response['mempoolInfo'] = mempoolInfo;
          response['txPerSecond'] = txPerSecond;
          response['vBytesPerSecond'] = vBytesPerSecond;
          response['track-tx'] = {
            tracking: client['trackingTx'] || false,
            blockHeight: client['blockHeight'],
          };
        }

        if (client['want-projected-blocks'] && client['trackingTx'] && client['blockHeight'] === 0) {
          response['projectedBlocks'] = projectedBlocks.getProjectedBlocks(client['txId']);
        } else if (client['want-projected-blocks']) {
          response['projectedBlocks'] = pBlocks;
        }

        if (Object.keys(response).length) {
          client.send(JSON.stringify(response));
        }
      });
    });

    statistics.setNewStatisticsEntryCallback((stats: IMempoolStats) => {
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
  }

  private setUpRoutes() {
    this.app
      .get(config.API_ENDPOINT + 'transactions/height/:id', routes.$getgetTransactionsForBlock)
      .get(config.API_ENDPOINT + 'transactions/projected/:id', routes.getgetTransactionsForProjectedBlock)
      .get(config.API_ENDPOINT + 'fees/recommended', routes.getRecommendedFees)
      .get(config.API_ENDPOINT + 'fees/projected-blocks', routes.getProjectedBlocks)
      .get(config.API_ENDPOINT + 'statistics/2h', routes.get2HStatistics)
      .get(config.API_ENDPOINT + 'statistics/24h', routes.get24HStatistics.bind(routes))
      .get(config.API_ENDPOINT + 'statistics/1w', routes.get1WHStatistics.bind(routes))
      .get(config.API_ENDPOINT + 'statistics/1m', routes.get1MStatistics.bind(routes))
      .get(config.API_ENDPOINT + 'statistics/3m', routes.get3MStatistics.bind(routes))
      .get(config.API_ENDPOINT + 'statistics/6m', routes.get6MStatistics.bind(routes))
      ;

    if (config.BACKEND_API === 'esplora') {
      this.app
        .get(config.API_ENDPOINT + 'explorer/blocks', routes.getBlocks)
        .get(config.API_ENDPOINT + 'explorer/blocks/:height', routes.getBlocks)
        .get(config.API_ENDPOINT + 'explorer/tx/:id', routes.getRawTransaction)
        ;
    }

    }
  }

const mempoolSpace = new MempoolSpace();
