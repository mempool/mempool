import config from './config';
import { createPool, Pool, PoolConnection } from 'mysql2/promise';
import logger from './logger';
import { FieldPacket, OkPacket, PoolOptions, ResultSetHeader, RowDataPacket } from 'mysql2/typings/mysql';

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

  private checkDBFlag() {
    if (config.DATABASE.ENABLED === false) {
      const stack = new Error().stack;
      logger.err(`Trying to use DB feature but config.DATABASE.ENABLED is set to false, please open an issue.\nStack trace: ${stack}}`);
    }
  }

  public async query<T extends RowDataPacket[][] | RowDataPacket[] | OkPacket |
    OkPacket[] | ResultSetHeader>(query, params?): Promise<[T, FieldPacket[]]>
  {
    this.checkDBFlag();
    let hardTimeout;
    if (query?.timeout != null) {
      hardTimeout = Math.floor(query.timeout * 1.1);
    } else {
      hardTimeout = config.DATABASE.TIMEOUT;
    }
    if (hardTimeout > 0) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`DB query failed to return, reject or time out within ${hardTimeout / 1000}s - ${query?.sql?.slice(0, 160) || (typeof(query) === 'string' || query instanceof String ? query?.slice(0, 160) : 'unknown query')}`));
        }, hardTimeout);

        this.getPool().then(pool => {
          return pool.query(query, params) as Promise<[T, FieldPacket[]]>;
        }).then(result => {
          resolve(result);
        }).catch(error => {
          reject(error);
        }).finally(() => {
          clearTimeout(timer);
        });
      });
    } else {
      const pool = await this.getPool();
      return pool.query(query, params);
    }
  }

  public async checkDbConnection() {
    this.checkDBFlag();
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
