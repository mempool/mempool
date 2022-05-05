import config from './config';
import DB from './database';
import logger from './logger';

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

class DatabaseMigration {
  private static currentVersion = 1;
  private queryTimeout = 120000;

  constructor() { }
  /**
   * Entry point
   */
  public async $initializeOrMigrateDatabase(): Promise<void> {
    logger.debug('MIGRATIONS: Running migrations');

    await this.$printDatabaseVersion();

    // First of all, if the `state` database does not exist, create it so we can track migration version
    if (!await this.$checkIfTableExists('state')) {
      logger.debug('MIGRATIONS: `state` table does not exist. Creating it.');
      try {
        await this.$createMigrationStateTable();
      } catch (e) {
        logger.err('MIGRATIONS: Unable to create `state` table, aborting in 10 seconds. ' + e);
        await sleep(10000);
        process.exit(-1);
      }
      logger.debug('MIGRATIONS: `state` table initialized.');
    }

    let databaseSchemaVersion = 0;
    try {
      databaseSchemaVersion = await this.$getSchemaVersionFromDatabase();
    } catch (e) {
      logger.err('MIGRATIONS: Unable to get current database migration version, aborting in 10 seconds. ' + e);
      await sleep(10000);
      process.exit(-1);
    }

    logger.debug('MIGRATIONS: Current state.schema_version ' + databaseSchemaVersion);
    logger.debug('MIGRATIONS: Latest DatabaseMigration.version is ' + DatabaseMigration.currentVersion);
    if (databaseSchemaVersion >= DatabaseMigration.currentVersion) {
      logger.debug('MIGRATIONS: Nothing to do.');
      return;
    }

    // Now, create missing tables. Those queries cannot be wrapped into a transaction unfortunately
    try {
      await this.$createMissingTablesAndIndexes(databaseSchemaVersion);
    } catch (e) {
      logger.err('MIGRATIONS: Unable to create required tables, aborting in 10 seconds. ' + e);
      await sleep(10000);
      process.exit(-1);
    }

    if (DatabaseMigration.currentVersion > databaseSchemaVersion) {
      logger.notice('MIGRATIONS: Upgrading datababse schema');
      try {
        await this.$migrateTableSchemaFromVersion(databaseSchemaVersion);
        logger.notice(`MIGRATIONS: OK. Database schema have been migrated from version ${databaseSchemaVersion} to ${DatabaseMigration.currentVersion} (latest version)`);
      } catch (e) {
        logger.err('MIGRATIONS: Unable to migrate database, aborting. ' + e);
      }
    }

    return;
  }

  /**
   * Create all missing tables
   */
  private async $createMissingTablesAndIndexes(databaseSchemaVersion: number) {
    try {
      await this.$executeQuery(this.getCreateStatisticsQuery(), await this.$checkIfTableExists('statistics'));
      await this.$executeQuery(this.getCreateNodesQuery(), await this.$checkIfTableExists('nodes'));
      await this.$executeQuery(this.getCreateChannelsQuery(), await this.$checkIfTableExists('channels'));
      await this.$executeQuery(this.getCreateNodesStatsQuery(), await this.$checkIfTableExists('nodes_stats'));
    } catch (e) {
      throw e;
    }
  }

  /**
   * Small query execution wrapper to log all executed queries
   */
  private async $executeQuery(query: string, silent: boolean = false): Promise<any> {
    if (!silent) {
      logger.debug('MIGRATIONS: Execute query:\n' + query);
    }
    return DB.query({ sql: query, timeout: this.queryTimeout });
  }

  /**
   * Check if 'table' exists in the database
   */
  private async $checkIfTableExists(table: string): Promise<boolean> {
    const query = `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${config.DATABASE.DATABASE}' AND TABLE_NAME = '${table}'`;
    const [rows] = await DB.query({ sql: query, timeout: this.queryTimeout });
    return rows[0]['COUNT(*)'] === 1;
  }

  /**
   * Get current database version
   */
  private async $getSchemaVersionFromDatabase(): Promise<number> {
    const query = `SELECT number FROM state WHERE name = 'schema_version';`;
    const [rows] = await this.$executeQuery(query, true);
    return rows[0]['number'];
  }

  /**
   * Create the `state` table
   */
  private async $createMigrationStateTable(): Promise<void> {
    try {
      const query = `CREATE TABLE IF NOT EXISTS state (
        name varchar(25) NOT NULL,
        number int(11) NULL,
        string varchar(100) NULL,
        CONSTRAINT name_unique UNIQUE (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
      await this.$executeQuery(query);

      // Set initial values
      await this.$executeQuery(`INSERT INTO state VALUES('schema_version', 0, NULL);`);
      await this.$executeQuery(`INSERT INTO state VALUES('last_node_stats', 0, '1970-01-01');`);
    } catch (e) {
      throw e;
    }
  }

  /**
   * We actually execute the migrations queries here
   */
  private async $migrateTableSchemaFromVersion(version: number): Promise<void> {
    const transactionQueries: string[] = [];
    for (const query of this.getMigrationQueriesFromVersion(version)) {
      transactionQueries.push(query);
    }
    transactionQueries.push(this.getUpdateToLatestSchemaVersionQuery());

    try {
      await this.$executeQuery('START TRANSACTION;');
      for (const query of transactionQueries) {
        await this.$executeQuery(query);
      }
      await this.$executeQuery('COMMIT;');
    } catch (e) {
      await this.$executeQuery('ROLLBACK;');
      throw e;
    }
  }

  /**
   * Generate migration queries based on schema version
   */
  private getMigrationQueriesFromVersion(version: number): string[] {
    const queries: string[] = [];
    return queries;
  }

  /**
   * Save the schema version in the database
   */
  private getUpdateToLatestSchemaVersionQuery(): string {
    return `UPDATE state SET number = ${DatabaseMigration.currentVersion} WHERE name = 'schema_version';`;
  }

  /**
   * Print current database version
   */
  private async $printDatabaseVersion() {
    try {
      const [rows] = await this.$executeQuery('SELECT VERSION() as version;', true);
      logger.debug(`MIGRATIONS: Database engine version '${rows[0].version}'`);
    } catch (e) {
      logger.debug(`MIGRATIONS: Could not fetch database engine version. ` + e);
    }
  }

  private getCreateStatisticsQuery(): string {
    return `CREATE TABLE IF NOT EXISTS statistics (
      id int(11) NOT NULL AUTO_INCREMENT,
      added datetime NOT NULL,
      channel_count int(11) NOT NULL,
      node_count int(11) NOT NULL,
      total_capacity double unsigned NOT NULL,
      average_channel_size double unsigned NOT NULL,
      CONSTRAINT PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }

  private getCreateNodesQuery(): string {
    return `CREATE TABLE IF NOT EXISTS nodes (
      public_key varchar(66) NOT NULL,
      first_seen datetime NOT NULL,
      updated_at datetime NOT NULL,
      alias varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
      color varchar(200) NOT NULL,
        CONSTRAINT PRIMARY KEY (public_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }

  private getCreateChannelsQuery(): string {
    return `CREATE TABLE IF NOT EXISTS channels (
      id varchar(15) NOT NULL,
      capacity bigint(20) unsigned NOT NULL,
      transaction_id varchar(64) NOT NULL,
      transaction_vout int(11) NOT NULL,
      updated_at datetime DEFAULT NULL,
      node1_public_key varchar(66) NOT NULL,
      node1_base_fee_mtokens bigint(20) unsigned DEFAULT NULL,
      node1_cltv_delta int(11) DEFAULT NULL,
      node1_fee_rate bigint(11) DEFAULT NULL,
      node1_is_disabled tinyint(1) DEFAULT NULL,
      node1_max_htlc_mtokens bigint(20) unsigned DEFAULT NULL,
      node1_min_htlc_mtokens bigint(20) unsigned DEFAULT NULL,
      node1_updated_at datetime DEFAULT NULL,
      node2_public_key varchar(66) NOT NULL,
      node2_base_fee_mtokens bigint(20) unsigned DEFAULT NULL,
      node2_cltv_delta int(11) DEFAULT NULL,
      node2_fee_rate bigint(11) DEFAULT NULL,
      node2_is_disabled tinyint(1) DEFAULT NULL,
      node2_max_htlc_mtokens bigint(20) unsigned DEFAULT NULL,
      node2_min_htlc_mtokens bigint(20) unsigned DEFAULT NULL,
      node2_updated_at datetime DEFAULT NULL,
      PRIMARY KEY (id),
      KEY node1_public_key (node1_public_key),
      KEY node2_public_key (node2_public_key),
      KEY node1_public_key_2 (node1_public_key,node2_public_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }

  private getCreateNodesStatsQuery(): string {
    return `CREATE TABLE nodes_stats (
      id int(11) unsigned NOT NULL AUTO_INCREMENT,
      public_key varchar(66) NOT NULL DEFAULT '',
      added date NOT NULL,
      capacity bigint(11) unsigned DEFAULT NULL,
      channels int(11) unsigned DEFAULT NULL,
      PRIMARY KEY (id),
      KEY public_key (public_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }
}

export default new DatabaseMigration();
