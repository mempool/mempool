import config from './config';
import { createPool, Pool, PoolConnection } from 'mysql2/promise';
import logger from './logger';
import { PoolOptions } from 'mysql2/typings/mysql';

export class DB {
  static connectionsReady: number[] = [];
  static pool: Pool | null = null;

  static poolConfig = (): PoolOptions => {
    const poolConfig: PoolOptions = {
      port: config.DATABASE.PORT,
      database: config.DATABASE.DATABASE,
      user: config.DATABASE.USERNAME,
      password: config.DATABASE.PASSWORD,
      connectionLimit: 10,
      supportBigNumbers: true,
      timezone: '+00:00',
    };

    if (config.DATABASE.SOCKET !== '') {
      poolConfig.socketPath = config.DATABASE.SOCKET;
    } else {
      poolConfig.host = config.DATABASE.HOST;
    }

    return poolConfig;
  }

  static async getPool(): Promise<Pool> {
    if (DB.pool === null) {
      DB.pool = createPool(DB.poolConfig());
      DB.pool.on('connection', function (newConnection: PoolConnection) {
        newConnection.query(`SET time_zone='+00:00'`);
      });
    }
    return DB.pool;
  }

  static async query(query, params?) {
    const pool = await DB.getPool();
    return pool.query(query, params);
  }
}

export async function checkDbConnection() {
  try {
    await DB.query('SELECT ?', [1]);
    logger.info('Database connection established.');
  } catch (e) {
    logger.err('Could not connect to database: ' + (e instanceof Error ? e.message : e));
    process.exit(1);
  }
}
