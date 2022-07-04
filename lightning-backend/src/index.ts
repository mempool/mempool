import DB from './database';
import databaseMigration from './database-migration';
import statsUpdater from './tasks/stats-updater.service';
import nodeSyncService from './tasks/node-sync.service';
import server from './server';

class LightningServer {
  constructor() {
    this.init();
  }

  async init() {
    await DB.checkDbConnection();
    await databaseMigration.$initializeOrMigrateDatabase();

    nodeSyncService.$startService();
    statsUpdater.$startService();

    server.startServer();
  }
}

const lightningServer = new LightningServer();
