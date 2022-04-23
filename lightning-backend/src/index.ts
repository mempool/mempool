import config from './config';
import logger from './logger';
import DB from './database';
import databaseMigration from './database-migration';
import statsUpdater from './tasks/stats-updater.service';
import nodeSyncService from './tasks/node-sync.service';

logger.notice(`Mempool Server is running on port ${config.MEMPOOL.HTTP_PORT}`);

class LightningServer {
  constructor() {
    this.init();
  }

  async init() {
    await DB.checkDbConnection();
    await databaseMigration.$initializeOrMigrateDatabase();

    statsUpdater.startService();
    nodeSyncService.startService();
  }
}

const lightningServer = new LightningServer();
