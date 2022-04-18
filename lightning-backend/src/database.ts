import config from './config';
import { createPool, Pool, PoolConnection } from 'mysql2/promise';
import logger from './logger';
import { PoolOptions } from 'mysql2/typings/mysql';

 class DB {
  constructor() {
    if (config.DATABASE.SOCKET !== '') {
      this.poolConfig.socketPath = config.DATABASE.SOCKET;
    } else {
      this.poolConfig.host = config.DATABASE.HOST;
    }
  }
  private pool: Pool | null = null;
  private poolConfig: PoolOptions = {
    port: config.DATABASE.PORT,
    database: config.DATABASE.DATABASE,
    user: config.DATABASE.USERNAME,
    password: config.DATABASE.PASSWORD,
    connectionLimit: 10,
    supportBigNumbers: true,
    timezone: '+00:00',
  };

  public async query(query, params?) {
    const pool = await this.getPool();
    return pool.query(query, params);
  }

  public async checkDbConnection() {
    try {
      await this.query('SELECT ?', [1]);
      logger.info('Database connection established.');
    } catch (e) {
      logger.err('Could not connect to database: ' + (e instanceof Error ? e.message : e));
      process.exit(1);
    }
  }

  private async getPool(): Promise<Pool> {
    if (this.pool === null) {
      this.pool = createPool(this.poolConfig);
      this.pool.on('connection', function (newConnection: PoolConnection) {
        newConnection.query(`SET time_zone='+00:00'`);
      });
    }
    return this.pool;
  }
}

export default new DB();
