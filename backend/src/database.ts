import * as fs from 'fs';
import path from 'path';
import config from './config';
import { createPool, Pool, PoolConnection } from 'mysql2/promise';
import logger, { LogLevel } from './logger';
import { FieldPacket, OkPacket, PoolOptions, ResultSetHeader, RowDataPacket } from 'mysql2/typings/mysql';
import { execSync } from 'child_process';

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
    connectionLimit: config.DATABASE.POOL_SIZE,
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
    OkPacket[] | ResultSetHeader>(query, params?, errorLogLevel: LogLevel | 'silent' = 'debug', connection?: PoolConnection): Promise<[T, FieldPacket[]]>
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

        // Use a specific connection if provided, otherwise delegate to the pool
        const connectionPromise = connection ? Promise.resolve(connection) : this.getPool();
        connectionPromise.then((pool: PoolConnection | Pool) => {
          return pool.query(query, params) as Promise<[T, FieldPacket[]]>;
        }).then(result => {
          resolve(result);
        }).catch(error => {
          if (errorLogLevel !== 'silent') {
            logger[errorLogLevel](`database query "${query?.sql?.slice(0, 160) || (typeof(query) === 'string' || query instanceof String ? query?.slice(0, 160) : 'unknown query')}" failed!`);
          }
          reject(error);
        }).finally(() => {
          clearTimeout(timer);
        });
      });
    } else {
      try {
        const pool = await this.getPool();
        return pool.query(query, params);
      } catch (e) {
        if (errorLogLevel !== 'silent') {
          logger[errorLogLevel](`database query "${query?.sql?.slice(0, 160) || (typeof(query) === 'string' || query instanceof String ? query?.slice(0, 160) : 'unknown query')}" failed!`);
        }
        throw e;
      }
    }
  }

  private async $rollbackAtomic(connection: PoolConnection): Promise<void> {
    try {
      await connection.rollback();
      await connection.release();
    } catch (e) {
      logger.warn('Failed to rollback incomplete db transaction: ' + (e instanceof Error ? e.message : e));
    }
  }

  public async $atomicQuery<T extends RowDataPacket[][] | RowDataPacket[] | OkPacket |
    OkPacket[] | ResultSetHeader>(queries: { query, params }[], errorLogLevel: LogLevel | 'silent' = 'debug'): Promise<[T, FieldPacket[]][]>
  {
    const pool = await this.getPool();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const results: [T, FieldPacket[]][]  = [];
      for (const query of queries) {
        const result = await this.query(query.query, query.params, errorLogLevel, connection) as [T, FieldPacket[]];
        results.push(result);
      }

      await connection.commit();

      return results;
    } catch (e) {
      logger.warn('Could not complete db transaction, rolling back: ' + (e instanceof Error ? e.message : e));
      this.$rollbackAtomic(connection);
      throw e;
    } finally {
      connection.release();
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

  public getPidLock(): boolean {
    const filePath = path.join(config.DATABASE.PID_DIR || __dirname, `/mempool-${config.DATABASE.DATABASE}.pid`);
    this.enforcePidLock(filePath);
    fs.writeFileSync(filePath, `${process.pid}`);
    return true;
  }

  private enforcePidLock(filePath: string): void {
    if (fs.existsSync(filePath)) {
      const pid = parseInt(fs.readFileSync(filePath, 'utf-8'));
      if (pid === process.pid) {
        logger.warn('PID file already exists for this process');
        return;
      }

      let cmd;
      try {
        cmd = execSync(`ps -p ${pid} -o args=`);
      } catch (e) {
        logger.warn(`Stale PID file at ${filePath}, but no process running on that PID ${pid}`);
        return;
      }

      if (cmd && cmd.toString()?.includes('node')) {
        const msg = `Another mempool nodejs process is already running on PID ${pid}`;
        logger.err(msg);
        throw new Error(msg);
      } else {
        logger.warn(`Stale PID file at ${filePath}, but the PID ${pid} does not belong to a running mempool instance`);
      }
    }
  }

  public releasePidLock(): void {
    const filePath = path.join(config.DATABASE.PID_DIR || __dirname, `/mempool-${config.DATABASE.DATABASE}.pid`);
    if (fs.existsSync(filePath)) {
      const pid = parseInt(fs.readFileSync(filePath, 'utf-8'));
      // only release our own pid file
      if (pid === process.pid) {
        fs.unlinkSync(filePath);
      }
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
