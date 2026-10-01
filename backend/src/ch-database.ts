import { ClickHouseClient, createClient } from '@clickhouse/client';
import config from './config';
import logger from './logger';

class ChDB {
  private clickhouse: ClickHouseClient;

  constructor() {
    this.clickhouse = createClient({
      url: config.CLICKHOUSE.URL,
      username: config.CLICKHOUSE.USERNAME,
      password: config.CLICKHOUSE.PASSWORD,
      database: config.CLICKHOUSE.DATABASE,
      clickhouse_settings: {
        output_format_json_quote_64bit_integers: 0,
      },
    });
  }

  /** @asyncUnsafe */
  private checkDBFlag(): void {
    if (config.CLICKHOUSE.ENABLED === false) {
      const stack = new Error().stack;
      logger.err(`Trying to use ClickHouse feature but config.CLICKHOUSE.ENABLED is set to false, please open an issue.\nStack trace: ${stack}`);
    }
  }

  /** @asyncUnsafe */
  public async query<T>(query: string, params?: Record<string, unknown>): Promise<T[]> {
    this.checkDBFlag();
    try {
      const result = await this.clickhouse.query({
        query,
        query_params: params,
        format: 'JSONEachRow',
      });
      return await result.json<T>();
    } catch (e) {
      logger.debug(`ClickHouse query "${query.slice(0, 160)}" failed!`);
      throw e;
    }
  }

  /** @asyncUnsafe */
  public async command(query: string, params?: Record<string, unknown>): Promise<void> {
    this.checkDBFlag();
    try {
      await this.clickhouse.command({
        query,
        query_params: params,
      });
    } catch (e) {
      logger.debug(`ClickHouse command "${query.slice(0, 160)}" failed!`);
      throw e;
    }
  }

  /** @asyncUnsafe */
  public async insert<T>(table: string, values: T[]): Promise<void> {
    this.checkDBFlag();
    if (values.length === 0) {
      return;
    }
    try {
      await this.clickhouse.insert({
        table,
        values,
        format: 'JSONEachRow',
      });
    } catch (e) {
      logger.debug(`ClickHouse insert into "${table.slice(0, 160)}" failed!`);
      throw e;
    }
  }

  /** @asyncSafe */
  public async checkConnection(): Promise<void> {
    this.checkDBFlag();
    try {
      const result = await this.clickhouse.ping();
      if (result.success) {
        logger.info('clickhouse connection established');
      }
    } catch (e) {
      logger.err('Could not connect to clickchouse database: ' + (e instanceof Error ? e.message : e));
      process.exit(1);
    }
  }

  /** @asyncUnsafe */
  public async close(): Promise<void> {
    await this.clickhouse.close();
  }
}

export default new ChDB();
