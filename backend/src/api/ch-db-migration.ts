import config from '../config';
import chDatabase from '../ch-database';
import logger from '../logger';
import { Common } from './common';

class ChDbMigration {
  private static currentVersion = 1;

  /** @asyncUnsafe */
  public async $initializeOrMigrateDatabase(): Promise<void> {
    logger.debug('CH MIGRATIONS: Running migrations');

    await this.$printDatabaseVersion();

    let schemaVersion = 0;
    try {
      await this.$executeCommand(this.getCreateMigrationsTableQuery(), true);
      schemaVersion = await this.$getSchemaVersionFromDatabase();
    } catch (e) {
      logger.err(`CH MIGRATIONS: Unable to get current schema version of ClickHouse database '${config.CLICKHOUSE.DATABASE}', aborting in 10 seconds. ` + e);
      await Common.sleep$(10000);
      process.exit(-1);
    }

    logger.debug('CH MIGRATIONS: Current schema version ' + schemaVersion);
    logger.debug('CH MIGRATIONS: Latest ChDbMigration.version is ' + ChDbMigration.currentVersion);
    if (schemaVersion >= ChDbMigration.currentVersion) {
      logger.debug('CH MIGRATIONS: Nothing to do.');
      return;
    }

    try {
      await this.$migrateFromVersion(schemaVersion);
      if (schemaVersion === 0) {
        logger.notice(`CH MIGRATIONS: OK. ClickHouse schema has been initialized to version ${ChDbMigration.currentVersion} (latest version)`);
      } else {
        logger.notice(`CH MIGRATIONS: OK. ClickHouse schema has been migrated from version ${schemaVersion} to ${ChDbMigration.currentVersion} (latest version)`);
      }
    } catch (e) {
      logger.err('CH MIGRATIONS: Unable to migrate ClickHouse database, aborting in 10 seconds. ' + e);
      await Common.sleep$(10000);
      process.exit(-1);
    }
  }

  /** @asyncUnsafe */
  private async $migrateFromVersion(version: number): Promise<void> {
    if (version < 1) {
      await this.$executeCommand(this.getCreateAddressTxsTableQuery());
      await this.$saveSchemaVersion(1);
    }
  }

  /** @asyncUnsafe */
  private async $executeCommand(query: string, silent = false): Promise<void> {
    if (!silent) {
      logger.debug('CH MIGRATIONS: Execute query:\n' + query);
    }
    await chDatabase.command(query);
  }

  /** @asyncUnsafe */
  private async $getSchemaVersionFromDatabase(): Promise<number> {
    const rows = await chDatabase.query<{ version: number }>('SELECT max(version) AS version FROM schema_migrations');
    return rows[0]?.version ?? 0;
  }

  /** @asyncUnsafe */
  private async $saveSchemaVersion(version: number): Promise<void> {
    await chDatabase.insert('schema_migrations', [{ version }]);
  }

  private async $printDatabaseVersion(): Promise<void> {
    try {
      const rows = await chDatabase.query<{ version: string }>('SELECT version() AS version');
      logger.debug(`CH MIGRATIONS: ClickHouse version '${rows[0]?.version}'`);
    } catch (e) {
      logger.debug(`CH MIGRATIONS: Could not fetch ClickHouse version. ` + e);
    }
  }

  private getCreateMigrationsTableQuery(): string {
    return `CREATE TABLE IF NOT EXISTS schema_migrations
    (
      version    UInt32,
      applied_at DateTime DEFAULT now()
    )
    ENGINE = MergeTree
    ORDER BY version`;
  }

  private getCreateAddressTxsTableQuery(): string {
    return `CREATE TABLE IF NOT EXISTS address_txs
    (
      scripthash      FixedString(32) CODEC(ZSTD(3)),
      txid            FixedString(32) CODEC(ZSTD(3)),
      tx_position     UInt16,
      block_height    UInt32 CODEC(Delta(4), ZSTD(3)),
      block_timestamp UInt32 CODEC(Delta(4), ZSTD(3)),
      net_value       Int64  CODEC(T64, ZSTD(3))
    )
    ENGINE = MergeTree
    PARTITION BY intDiv(block_height, 100000)
    ORDER BY (scripthash, block_height, tx_position)`;
  }
}

export default new ChDbMigration();
