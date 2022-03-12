import config from './config';
import { createPool, PoolConnection } from 'mysql2/promise';
import logger from './logger';

export class DB {
  static pool = createPool({
    host: config.DATABASE.HOST,
    port: config.DATABASE.PORT,
    database: config.DATABASE.DATABASE,
    user: config.DATABASE.USERNAME,
    password: config.DATABASE.PASSWORD,
    connectionLimit: 10,
    supportBigNumbers: true,
  });

  static connectionsReady: number[] = [];

  static async getConnection() {
    const connection: PoolConnection = await DB.pool.getConnection();
    const connectionId = connection['connection'].connectionId;
    if (!DB.connectionsReady.includes(connectionId)) {
      await connection.query(`SET time_zone='+00:00';`);
      this.connectionsReady.push(connectionId);
    }
    return connection;
  }
}

export async function checkDbConnection() {
  try {
    const connection = await DB.getConnection();
    logger.info('Database connection established.');
    connection.release();
  } catch (e) {
    logger.err('Could not connect to database: ' + (e instanceof Error ? e.message : e));
    process.exit(1);
  }
}
