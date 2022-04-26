import config from './config';
import * as express from 'express';
import * as http from 'http';
import logger from './logger';
import DB from './database';
import { Express, Request, Response, NextFunction } from 'express';
import databaseMigration from './database-migration';
import statsUpdater from './tasks/stats-updater.service';
import nodeSyncService from './tasks/node-sync.service';
import NodesRoutes from './api/nodes/nodes.routes';

logger.notice(`Mempool Server is running on port ${config.MEMPOOL.HTTP_PORT}`);

class LightningServer {
  private server: http.Server | undefined;
  private app: Express = express();

  constructor() {
    this.init();
  }

  async init() {
    await DB.checkDbConnection();
    await databaseMigration.$initializeOrMigrateDatabase();

    statsUpdater.startService();
    nodeSyncService.startService();

    this.startServer();
  }

  startServer() {
    this.app
      .use((req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        next();
      })
      .use(express.urlencoded({ extended: true }))
      .use(express.text())
    ;

    this.server = http.createServer(this.app);

    this.server.listen(config.MEMPOOL.HTTP_PORT, () => {
      logger.notice(`Mempool Lightning is running on port ${config.MEMPOOL.HTTP_PORT}`);
    });

    const nodeRoutes = new NodesRoutes(this.app);
  }
}

const lightningServer = new LightningServer();
