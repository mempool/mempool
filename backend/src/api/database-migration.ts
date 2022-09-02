import config from '../config';
import DB from '../database';
import logger from '../logger';
import { Common } from './common';

class DatabaseMigration {
  private static currentVersion = 40;
  private queryTimeout = 120000;
  private statisticsAddedIndexed = false;
  private uniqueLogs: string[] = [];

  private blocksTruncatedMessage = `'blocks' table has been truncated.`;
  private hashratesTruncatedMessage = `'hashrates' table has been truncated.`;

  /**
   * Avoid printing multiple time the same message
   */
  private uniqueLog(loggerFunction: any, msg: string) {
    if (this.uniqueLogs.includes(msg)) {
      return;
    }
    this.uniqueLogs.push(msg);
    loggerFunction(msg);
  }

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
        await Common.sleep$(10000);
        process.exit(-1);
      }
      logger.debug('MIGRATIONS: `state` table initialized.');
    }

    let databaseSchemaVersion = 0;
    try {
      databaseSchemaVersion = await this.$getSchemaVersionFromDatabase();
    } catch (e) {
      logger.err('MIGRATIONS: Unable to get current database migration version, aborting in 10 seconds. ' + e);
      await Common.sleep$(10000);
      process.exit(-1);
    }

    if (databaseSchemaVersion === 0) {
      logger.info('Initializing database (first run, clean install)');
    }

    if (databaseSchemaVersion <= 2) {
      // Disable some spam logs when they're not relevant
      this.uniqueLogs.push(this.blocksTruncatedMessage);
      this.uniqueLogs.push(this.hashratesTruncatedMessage);
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
      await Common.sleep$(10000);
      process.exit(-1);
    }

    if (DatabaseMigration.currentVersion > databaseSchemaVersion) {
      try {
        await this.$migrateTableSchemaFromVersion(databaseSchemaVersion);
        if (databaseSchemaVersion === 0) {
          logger.notice(`MIGRATIONS: OK. Database schema has been properly initialized to version ${DatabaseMigration.currentVersion} (latest version)`);          
        } else {
          logger.notice(`MIGRATIONS: OK. Database schema have been migrated from version ${databaseSchemaVersion} to ${DatabaseMigration.currentVersion} (latest version)`);
        }
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
    await this.$setStatisticsAddedIndexedFlag(databaseSchemaVersion);

    const isBitcoin = ['mainnet', 'testnet', 'signet'].includes(config.MEMPOOL.NETWORK);

    await this.$executeQuery(this.getCreateElementsTableQuery(), await this.$checkIfTableExists('elements_pegs'));
    await this.$executeQuery(this.getCreateStatisticsQuery(), await this.$checkIfTableExists('statistics'));
    if (databaseSchemaVersion < 2 && this.statisticsAddedIndexed === false) {
      await this.$executeQuery(`CREATE INDEX added ON statistics (added);`);
    }
    if (databaseSchemaVersion < 3) {
      await this.$executeQuery(this.getCreatePoolsTableQuery(), await this.$checkIfTableExists('pools'));
    }
    if (databaseSchemaVersion < 4) {
      await this.$executeQuery('DROP table IF EXISTS blocks;');
      await this.$executeQuery(this.getCreateBlocksTableQuery(), await this.$checkIfTableExists('blocks'));
    }
    if (databaseSchemaVersion < 5 && isBitcoin === true) {
      this.uniqueLog(logger.notice, this.blocksTruncatedMessage);
      await this.$executeQuery('TRUNCATE blocks;'); // Need to re-index
      await this.$executeQuery('ALTER TABLE blocks ADD `reward` double unsigned NOT NULL DEFAULT "0"');
    }

    if (databaseSchemaVersion < 6 && isBitcoin === true) {
      this.uniqueLog(logger.notice, this.blocksTruncatedMessage);
      await this.$executeQuery('TRUNCATE blocks;');  // Need to re-index
      // Cleanup original blocks fields type
      await this.$executeQuery('ALTER TABLE blocks MODIFY `height` integer unsigned NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE blocks MODIFY `tx_count` smallint unsigned NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE blocks MODIFY `size` integer unsigned NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE blocks MODIFY `weight` integer unsigned NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE blocks MODIFY `difficulty` double NOT NULL DEFAULT "0"');
      // We also fix the pools.id type so we need to drop/re-create the foreign key
      await this.$executeQuery('ALTER TABLE blocks DROP FOREIGN KEY IF EXISTS `blocks_ibfk_1`');
      await this.$executeQuery('ALTER TABLE pools MODIFY `id` smallint unsigned AUTO_INCREMENT');
      await this.$executeQuery('ALTER TABLE blocks MODIFY `pool_id` smallint unsigned NULL');
      await this.$executeQuery('ALTER TABLE blocks ADD FOREIGN KEY (`pool_id`) REFERENCES `pools` (`id`)');
      // Add new block indexing fields
      await this.$executeQuery('ALTER TABLE blocks ADD `version` integer unsigned NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE blocks ADD `bits` integer unsigned NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE blocks ADD `nonce` bigint unsigned NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE blocks ADD `merkle_root` varchar(65) NOT NULL DEFAULT ""');
      await this.$executeQuery('ALTER TABLE blocks ADD `previous_block_hash` varchar(65) NULL');
    }

    if (databaseSchemaVersion < 7 && isBitcoin === true) {
      await this.$executeQuery('DROP table IF EXISTS hashrates;');
      await this.$executeQuery(this.getCreateDailyStatsTableQuery(), await this.$checkIfTableExists('hashrates'));
    }

    if (databaseSchemaVersion < 8 && isBitcoin === true) {
      this.uniqueLog(logger.notice, this.blocksTruncatedMessage);
      await this.$executeQuery('TRUNCATE hashrates;'); // Need to re-index
      await this.$executeQuery('ALTER TABLE `hashrates` DROP INDEX `PRIMARY`');
      await this.$executeQuery('ALTER TABLE `hashrates` ADD `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST');
      await this.$executeQuery('ALTER TABLE `hashrates` ADD `share` float NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE `hashrates` ADD `type` enum("daily", "weekly") DEFAULT "daily"');
    }

    if (databaseSchemaVersion < 9 && isBitcoin === true) {
      this.uniqueLog(logger.notice, this.hashratesTruncatedMessage);
      await this.$executeQuery('TRUNCATE hashrates;'); // Need to re-index
      await this.$executeQuery('ALTER TABLE `state` CHANGE `name` `name` varchar(100)');
      await this.$executeQuery('ALTER TABLE `hashrates` ADD UNIQUE `hashrate_timestamp_pool_id` (`hashrate_timestamp`, `pool_id`)');
    }

    if (databaseSchemaVersion < 10 && isBitcoin === true) {
      await this.$executeQuery('ALTER TABLE `blocks` ADD INDEX `blockTimestamp` (`blockTimestamp`)');
    }

    if (databaseSchemaVersion < 11 && isBitcoin === true) {
      this.uniqueLog(logger.notice, this.blocksTruncatedMessage);
      await this.$executeQuery('TRUNCATE blocks;'); // Need to re-index
      await this.$executeQuery(`ALTER TABLE blocks
        ADD avg_fee INT UNSIGNED NULL,
        ADD avg_fee_rate INT UNSIGNED NULL
      `);
      await this.$executeQuery('ALTER TABLE blocks MODIFY `reward` BIGINT UNSIGNED NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE blocks MODIFY `median_fee` INT UNSIGNED NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE blocks MODIFY `fees` INT UNSIGNED NOT NULL DEFAULT "0"');
    }

    if (databaseSchemaVersion < 12 && isBitcoin === true) {
      // No need to re-index because the new data type can contain larger values
      await this.$executeQuery('ALTER TABLE blocks MODIFY `fees` BIGINT UNSIGNED NOT NULL DEFAULT "0"');
    }

    if (databaseSchemaVersion < 13 && isBitcoin === true) {
      await this.$executeQuery('ALTER TABLE blocks MODIFY `difficulty` DOUBLE UNSIGNED NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE blocks MODIFY `median_fee` BIGINT UNSIGNED NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE blocks MODIFY `avg_fee` BIGINT UNSIGNED NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE blocks MODIFY `avg_fee_rate` BIGINT UNSIGNED NOT NULL DEFAULT "0"');
    }

    if (databaseSchemaVersion < 14 && isBitcoin === true) {
      this.uniqueLog(logger.notice, this.hashratesTruncatedMessage);
      await this.$executeQuery('TRUNCATE hashrates;'); // Need to re-index
      await this.$executeQuery('ALTER TABLE `hashrates` DROP FOREIGN KEY `hashrates_ibfk_1`');
      await this.$executeQuery('ALTER TABLE `hashrates` MODIFY `pool_id` SMALLINT UNSIGNED NOT NULL DEFAULT "0"');
    }

    if (databaseSchemaVersion < 16 && isBitcoin === true) {
      this.uniqueLog(logger.notice, this.hashratesTruncatedMessage);
      await this.$executeQuery('TRUNCATE hashrates;'); // Need to re-index because we changed timestamps
    }

    if (databaseSchemaVersion < 17 && isBitcoin === true) {
      await this.$executeQuery('ALTER TABLE `pools` ADD `slug` CHAR(50) NULL');
    }

    if (databaseSchemaVersion < 18 && isBitcoin === true) {
      await this.$executeQuery('ALTER TABLE `blocks` ADD INDEX `hash` (`hash`);');
    }

    if (databaseSchemaVersion < 19) {
      await this.$executeQuery(this.getCreateRatesTableQuery(), await this.$checkIfTableExists('rates'));
    }

    if (databaseSchemaVersion < 20 && isBitcoin === true) {
      await this.$executeQuery(this.getCreateBlocksSummariesTableQuery(), await this.$checkIfTableExists('blocks_summaries'));
    }

    if (databaseSchemaVersion < 21) {
      await this.$executeQuery('DROP TABLE IF EXISTS `rates`');
      await this.$executeQuery(this.getCreatePricesTableQuery(), await this.$checkIfTableExists('prices'));
    }

    if (databaseSchemaVersion < 22 && isBitcoin === true) {
      await this.$executeQuery('DROP TABLE IF EXISTS `difficulty_adjustments`');
      await this.$executeQuery(this.getCreateDifficultyAdjustmentsTableQuery(), await this.$checkIfTableExists('difficulty_adjustments'));
    }

    if (databaseSchemaVersion < 23) {
      await this.$executeQuery('TRUNCATE `prices`');
      await this.$executeQuery('ALTER TABLE `prices` DROP `avg_prices`');
      await this.$executeQuery('ALTER TABLE `prices` ADD `USD` float DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE `prices` ADD `EUR` float DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE `prices` ADD `GBP` float DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE `prices` ADD `CAD` float DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE `prices` ADD `CHF` float DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE `prices` ADD `AUD` float DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE `prices` ADD `JPY` float DEFAULT "0"');
    }

    if (databaseSchemaVersion < 24 && isBitcoin == true) {
      await this.$executeQuery('DROP TABLE IF EXISTS `blocks_audits`');
      await this.$executeQuery(this.getCreateBlocksAuditsTableQuery(), await this.$checkIfTableExists('blocks_audits'));
    }

    if (databaseSchemaVersion < 25 && isBitcoin === true) {
      await this.$executeQuery(this.getCreateLightningStatisticsQuery(), await this.$checkIfTableExists('lightning_stats'));
      await this.$executeQuery(this.getCreateNodesQuery(), await this.$checkIfTableExists('nodes'));
      await this.$executeQuery(this.getCreateChannelsQuery(), await this.$checkIfTableExists('channels'));
      await this.$executeQuery(this.getCreateNodesStatsQuery(), await this.$checkIfTableExists('node_stats'));
    }

    if (databaseSchemaVersion < 26 && isBitcoin === true) {
      if (config.LIGHTNING.ENABLED) {
        this.uniqueLog(logger.notice, `'lightning_stats' table has been truncated.`);
      }
      await this.$executeQuery(`TRUNCATE lightning_stats`);
      await this.$executeQuery('ALTER TABLE `lightning_stats` ADD tor_nodes int(11) NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE `lightning_stats` ADD clearnet_nodes int(11) NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE `lightning_stats` ADD unannounced_nodes int(11) NOT NULL DEFAULT "0"');
    }

    if (databaseSchemaVersion < 27 && isBitcoin === true) {
      await this.$executeQuery('ALTER TABLE `lightning_stats` ADD avg_capacity bigint(20) unsigned NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE `lightning_stats` ADD avg_fee_rate int(11) unsigned NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE `lightning_stats` ADD avg_base_fee_mtokens bigint(20) unsigned NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE `lightning_stats` ADD med_capacity bigint(20) unsigned NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE `lightning_stats` ADD med_fee_rate int(11) unsigned NOT NULL DEFAULT "0"');
      await this.$executeQuery('ALTER TABLE `lightning_stats` ADD med_base_fee_mtokens bigint(20) unsigned NOT NULL DEFAULT "0"');
    }
    
    if (databaseSchemaVersion < 28 && isBitcoin === true) {
      if (config.LIGHTNING.ENABLED) {
        this.uniqueLog(logger.notice, `'lightning_stats' and 'node_stats' tables have been truncated.`);
      }
      await this.$executeQuery(`TRUNCATE lightning_stats`);
      await this.$executeQuery(`TRUNCATE node_stats`);
      await this.$executeQuery(`ALTER TABLE lightning_stats MODIFY added DATE`);
    }

    if (databaseSchemaVersion < 29 && isBitcoin === true) {
      await this.$executeQuery(this.getCreateGeoNamesTableQuery(), await this.$checkIfTableExists('geo_names'));
      await this.$executeQuery('ALTER TABLE `nodes` ADD as_number int(11) unsigned NULL DEFAULT NULL');
      await this.$executeQuery('ALTER TABLE `nodes` ADD city_id int(11) unsigned NULL DEFAULT NULL');
      await this.$executeQuery('ALTER TABLE `nodes` ADD country_id int(11) unsigned NULL DEFAULT NULL');
      await this.$executeQuery('ALTER TABLE `nodes` ADD accuracy_radius int(11) unsigned NULL DEFAULT NULL');
      await this.$executeQuery('ALTER TABLE `nodes` ADD subdivision_id int(11) unsigned NULL DEFAULT NULL');
      await this.$executeQuery('ALTER TABLE `nodes` ADD longitude double NULL DEFAULT NULL');
      await this.$executeQuery('ALTER TABLE `nodes` ADD latitude double NULL DEFAULT NULL');
    }

    if (databaseSchemaVersion < 30 && isBitcoin === true) {
      await this.$executeQuery('ALTER TABLE `geo_names` CHANGE `type` `type` enum("city","country","division","continent","as_organization") NOT NULL');
    }

    if (databaseSchemaVersion < 31 && isBitcoin == true) { // Link blocks to prices
      await this.$executeQuery('ALTER TABLE `prices` ADD `id` int NULL AUTO_INCREMENT UNIQUE');
      await this.$executeQuery('DROP TABLE IF EXISTS `blocks_prices`');
      await this.$executeQuery(this.getCreateBlocksPricesTableQuery(), await this.$checkIfTableExists('blocks_prices'));
    }

    if (databaseSchemaVersion < 32 && isBitcoin == true) {
      await this.$executeQuery('ALTER TABLE `blocks_summaries` ADD `template` JSON DEFAULT "[]"');
    }

    if (databaseSchemaVersion < 33 && isBitcoin == true) {
      await this.$executeQuery('ALTER TABLE `geo_names` CHANGE `type` `type` enum("city","country","division","continent","as_organization", "country_iso_code") NOT NULL');
    }

    if (databaseSchemaVersion < 34 && isBitcoin == true) {
      await this.$executeQuery('ALTER TABLE `lightning_stats` ADD clearnet_tor_nodes int(11) NOT NULL DEFAULT "0"');
    }

    if (databaseSchemaVersion < 35 && isBitcoin == true) {
      await this.$executeQuery('DELETE from `lightning_stats` WHERE added > "2021-09-19"');
      await this.$executeQuery('ALTER TABLE `lightning_stats` ADD CONSTRAINT added_unique UNIQUE (added);');
    }

    if (databaseSchemaVersion < 36 && isBitcoin == true) {
      await this.$executeQuery('ALTER TABLE `nodes` ADD status TINYINT NOT NULL DEFAULT "1"');
    }

    if (databaseSchemaVersion < 37 && isBitcoin == true) {
      await this.$executeQuery(this.getCreateLNNodesSocketsTableQuery(), await this.$checkIfTableExists('nodes_sockets'));
    }

    if (databaseSchemaVersion < 38 && isBitcoin == true) {
      if (config.LIGHTNING.ENABLED) {
        this.uniqueLog(logger.notice, `'lightning_stats' and 'node_stats' tables have been truncated.`);
      }
      await this.$executeQuery(`TRUNCATE lightning_stats`);
      await this.$executeQuery(`TRUNCATE node_stats`);
      await this.$executeQuery('ALTER TABLE `lightning_stats` CHANGE `added` `added` timestamp NULL');
      await this.$executeQuery('ALTER TABLE `node_stats` CHANGE `added` `added` timestamp NULL');
    }

    if (databaseSchemaVersion < 39 && isBitcoin === true) {
      await this.$executeQuery('ALTER TABLE `nodes` ADD alias_search TEXT NULL DEFAULT NULL AFTER `alias`');
      await this.$executeQuery('ALTER TABLE nodes ADD FULLTEXT(alias_search)');
    }

    if (databaseSchemaVersion < 40 && isBitcoin === true) {
      await this.$executeQuery('ALTER TABLE `nodes` ADD capacity bigint(20) unsigned DEFAULT NULL');
      await this.$executeQuery('ALTER TABLE `nodes` ADD channels int(11) unsigned DEFAULT NULL');
      await this.$executeQuery('ALTER TABLE `nodes` ADD INDEX `capacity` (`capacity`);');
    }
  }

  /**
   * Special case here for the `statistics` table - It appeared that somehow some dbs already had the `added` field indexed
   * while it does not appear in previous schemas. The mariadb command "CREATE INDEX IF NOT EXISTS" is not supported on
   * older mariadb version. Therefore we set a flag here in order to know if the index needs to be created or not before
   * running the migration process
   */
  private async $setStatisticsAddedIndexedFlag(databaseSchemaVersion: number) {
    if (databaseSchemaVersion >= 2) {
      this.statisticsAddedIndexed = true;
      return;
    }

    try {
      // We don't use "CREATE INDEX IF NOT EXISTS" because it is not supported on old mariadb version 5.X
      const query = `SELECT COUNT(1) hasIndex FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_schema=DATABASE() AND table_name='statistics' AND index_name='added';`;
      const [rows] = await this.$executeQuery(query, true);
      if (rows[0].hasIndex === 0) {
        logger.debug('MIGRATIONS: `statistics.added` is not indexed');
        this.statisticsAddedIndexed = false;
      } else if (rows[0].hasIndex === 1) {
        logger.debug('MIGRATIONS: `statistics.added` is already indexed');
        this.statisticsAddedIndexed = true;
      }
    } catch (e) {
      // Should really never happen but just in case it fails, we just don't execute
      // any query related to this indexing so it won't fail if the index actually already exists
      logger.err('MIGRATIONS: Unable to check if `statistics.added` INDEX exist or not.');
      this.statisticsAddedIndexed = true;
    }
  }

  /**
   * Small query execution wrapper to log all executed queries
   */
  private async $executeQuery(query: string, silent = false): Promise<any> {
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
    const query = `CREATE TABLE IF NOT EXISTS state (
      name varchar(25) NOT NULL,
      number int(11) NULL,
      string varchar(100) NULL,
      CONSTRAINT name_unique UNIQUE (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
    await this.$executeQuery(query);

    // Set initial values
    await this.$executeQuery(`INSERT INTO state VALUES('schema_version', 0, NULL);`);
    await this.$executeQuery(`INSERT INTO state VALUES('last_elements_block', 0, NULL);`);
  }

  /**
   * We actually execute the migrations queries here
   */
  private async $migrateTableSchemaFromVersion(version: number): Promise<void> {
    const transactionQueries: string[] = [];
    for (const query of this.getMigrationQueriesFromVersion(version)) {
      transactionQueries.push(query);
    }

    logger.notice(`MIGRATIONS: ${version > 0 ? 'Upgrading' : 'Initializing'} database schema version number to ${DatabaseMigration.currentVersion}`);
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
    const isBitcoin = ['mainnet', 'testnet', 'signet'].includes(config.MEMPOOL.NETWORK);

    if (version < 1) {
      if (config.MEMPOOL.NETWORK !== 'liquid' && config.MEMPOOL.NETWORK !== 'liquidtestnet') {
        if (version > 0) {
          logger.notice(`MIGRATIONS: Migrating (shifting) statistics table data`);
        }
        queries.push(this.getShiftStatisticsQuery());
      }
    }

    if (version < 7 && isBitcoin === true) {
      queries.push(`INSERT INTO state(name, number, string) VALUES ('last_hashrates_indexing', 0, NULL)`);
    }

    if (version < 9  && isBitcoin === true) {
      queries.push(`INSERT INTO state(name, number, string) VALUES ('last_weekly_hashrates_indexing', 0, NULL)`);
    }

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

  // Couple of wrappers to clean the main logic
  private getShiftStatisticsQuery(): string {
    return `UPDATE statistics SET
      vsize_1 = vsize_1 + vsize_2, vsize_2 = vsize_3,
      vsize_3 = vsize_4, vsize_4 = vsize_5,
      vsize_5 = vsize_6, vsize_6 = vsize_8,
      vsize_8 = vsize_10, vsize_10 = vsize_12,
      vsize_12 = vsize_15, vsize_15 = vsize_20,
      vsize_20 = vsize_30, vsize_30 = vsize_40,
      vsize_40 = vsize_50, vsize_50 = vsize_60,
      vsize_60 = vsize_70, vsize_70 = vsize_80,
      vsize_80 = vsize_90, vsize_90 = vsize_100,
      vsize_100 = vsize_125, vsize_125 = vsize_150,
      vsize_150 = vsize_175, vsize_175 = vsize_200,
      vsize_200 = vsize_250, vsize_250 = vsize_300,
      vsize_300 = vsize_350, vsize_350 = vsize_400,
      vsize_400 = vsize_500, vsize_500 = vsize_600,
      vsize_600 = vsize_700, vsize_700 = vsize_800,
      vsize_800 = vsize_900, vsize_900 = vsize_1000,
      vsize_1000 = vsize_1200, vsize_1200 = vsize_1400,
      vsize_1400 = vsize_1800, vsize_1800 = vsize_2000, vsize_2000 = 0;`;
  }

  private getCreateStatisticsQuery(): string {
    return `CREATE TABLE IF NOT EXISTS statistics (
      id int(11) NOT NULL AUTO_INCREMENT,
      added datetime NOT NULL,
      unconfirmed_transactions int(11) UNSIGNED NOT NULL,
      tx_per_second float UNSIGNED NOT NULL,
      vbytes_per_second int(10) UNSIGNED NOT NULL,
      mempool_byte_weight int(10) UNSIGNED NOT NULL,
      fee_data longtext NOT NULL,
      total_fee double UNSIGNED NOT NULL,
      vsize_1 int(11) NOT NULL,
      vsize_2 int(11) NOT NULL,
      vsize_3 int(11) NOT NULL,
      vsize_4 int(11) NOT NULL,
      vsize_5 int(11) NOT NULL,
      vsize_6 int(11) NOT NULL,
      vsize_8 int(11) NOT NULL,
      vsize_10 int(11) NOT NULL,
      vsize_12 int(11) NOT NULL,
      vsize_15 int(11) NOT NULL,
      vsize_20 int(11) NOT NULL,
      vsize_30 int(11) NOT NULL,
      vsize_40 int(11) NOT NULL,
      vsize_50 int(11) NOT NULL,
      vsize_60 int(11) NOT NULL,
      vsize_70 int(11) NOT NULL,
      vsize_80 int(11) NOT NULL,
      vsize_90 int(11) NOT NULL,
      vsize_100 int(11) NOT NULL,
      vsize_125 int(11) NOT NULL,
      vsize_150 int(11) NOT NULL,
      vsize_175 int(11) NOT NULL,
      vsize_200 int(11) NOT NULL,
      vsize_250 int(11) NOT NULL,
      vsize_300 int(11) NOT NULL,
      vsize_350 int(11) NOT NULL,
      vsize_400 int(11) NOT NULL,
      vsize_500 int(11) NOT NULL,
      vsize_600 int(11) NOT NULL,
      vsize_700 int(11) NOT NULL,
      vsize_800 int(11) NOT NULL,
      vsize_900 int(11) NOT NULL,
      vsize_1000 int(11) NOT NULL,
      vsize_1200 int(11) NOT NULL,
      vsize_1400 int(11) NOT NULL,
      vsize_1600 int(11) NOT NULL,
      vsize_1800 int(11) NOT NULL,
      vsize_2000 int(11) NOT NULL,
      CONSTRAINT PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }

  private getCreateElementsTableQuery(): string {
    return `CREATE TABLE IF NOT EXISTS elements_pegs (
      block int(11) NOT NULL,
      datetime int(11) NOT NULL,
      amount bigint(20) NOT NULL,
      txid varchar(65) NOT NULL,
      txindex int(11) NOT NULL,
      bitcoinaddress varchar(100) NOT NULL,
      bitcointxid varchar(65) NOT NULL,
      bitcoinindex int(11) NOT NULL,
      final_tx int(11) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }

  private getCreatePoolsTableQuery(): string {
    return `CREATE TABLE IF NOT EXISTS pools (
      id int(11) NOT NULL AUTO_INCREMENT,
      name varchar(50) NOT NULL,
      link varchar(255) NOT NULL,
      addresses text NOT NULL,
      regexes text NOT NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
  }

  private getCreateBlocksTableQuery(): string {
    return `CREATE TABLE IF NOT EXISTS blocks (
      height int(11) unsigned NOT NULL,
      hash varchar(65) NOT NULL,
      blockTimestamp timestamp NOT NULL,
      size int(11) unsigned NOT NULL,
      weight int(11) unsigned NOT NULL,
      tx_count int(11) unsigned NOT NULL,
      coinbase_raw text,
      difficulty bigint(20) unsigned NOT NULL,
      pool_id int(11) DEFAULT -1,
      fees double unsigned NOT NULL,
      fee_span json NOT NULL,
      median_fee double unsigned NOT NULL,
      PRIMARY KEY (height),
      INDEX (pool_id),
      FOREIGN KEY (pool_id) REFERENCES pools (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }

  private getCreateDailyStatsTableQuery(): string {
    return `CREATE TABLE IF NOT EXISTS hashrates (
      hashrate_timestamp timestamp NOT NULL,
      avg_hashrate double unsigned DEFAULT '0',
      pool_id smallint unsigned NULL,
      PRIMARY KEY (hashrate_timestamp),
      INDEX (pool_id),
      FOREIGN KEY (pool_id) REFERENCES pools (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }

  private getCreateRatesTableQuery(): string { // This table has been replaced by the prices table
    return `CREATE TABLE IF NOT EXISTS rates (
      height int(10) unsigned NOT NULL,
      bisq_rates JSON NOT NULL,
      PRIMARY KEY (height)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }

  private getCreateBlocksSummariesTableQuery(): string {
    return `CREATE TABLE IF NOT EXISTS blocks_summaries (
      height int(10) unsigned NOT NULL,
      id varchar(65) NOT NULL,
      transactions JSON NOT NULL,
      PRIMARY KEY (id),
      INDEX (height)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }

  private getCreatePricesTableQuery(): string {
    return `CREATE TABLE IF NOT EXISTS prices (
      time timestamp NOT NULL,
      avg_prices JSON NOT NULL,
      PRIMARY KEY (time)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }

  private getCreateDifficultyAdjustmentsTableQuery(): string {
    return `CREATE TABLE IF NOT EXISTS difficulty_adjustments (
      time timestamp NOT NULL,
      height int(10) unsigned NOT NULL,
      difficulty double unsigned NOT NULL,
      adjustment float NOT NULL,
      PRIMARY KEY (height),
      INDEX (time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }

  private getCreateLightningStatisticsQuery(): string {
    return `CREATE TABLE IF NOT EXISTS lightning_stats (
      id int(11) NOT NULL AUTO_INCREMENT,
      added datetime NOT NULL,
      channel_count int(11) NOT NULL,
      node_count int(11) NOT NULL,
      total_capacity double unsigned NOT NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }

  private getCreateNodesQuery(): string {
    return `CREATE TABLE IF NOT EXISTS nodes (
      public_key varchar(66) NOT NULL,
      first_seen datetime NOT NULL,
      updated_at datetime NOT NULL,
      alias varchar(200) CHARACTER SET utf8mb4 NOT NULL,
      color varchar(200) NOT NULL,
      sockets text DEFAULT NULL,
      PRIMARY KEY (public_key),
      KEY alias (alias(10))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }

  private getCreateChannelsQuery(): string {
    return `CREATE TABLE IF NOT EXISTS channels (
      id bigint(11) unsigned NOT NULL,
      short_id varchar(15) NOT NULL DEFAULT '',
      capacity bigint(20) unsigned NOT NULL,
      transaction_id varchar(64) NOT NULL,
      transaction_vout int(11) NOT NULL,
      updated_at datetime DEFAULT NULL,
      created datetime DEFAULT NULL,
      status int(11) NOT NULL DEFAULT 0,
      closing_transaction_id varchar(64) DEFAULT NULL,
      closing_date datetime DEFAULT NULL,
      closing_reason int(11) DEFAULT NULL,
      node1_public_key varchar(66) NOT NULL,
      node1_base_fee_mtokens bigint(20) unsigned DEFAULT NULL,
      node1_cltv_delta int(11) DEFAULT NULL,
      node1_fee_rate bigint(11) DEFAULT NULL,
      node1_is_disabled tinyint(1) DEFAULT NULL,
      node1_max_htlc_mtokens bigint(20) unsigned DEFAULT NULL,
      node1_min_htlc_mtokens bigint(20) DEFAULT NULL,
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
      KEY status (status),
      KEY short_id (short_id),
      KEY transaction_id (transaction_id),
      KEY closing_transaction_id (closing_transaction_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }

  private getCreateNodesStatsQuery(): string {
    return `CREATE TABLE IF NOT EXISTS node_stats (
      id int(11) unsigned NOT NULL AUTO_INCREMENT,
      public_key varchar(66) NOT NULL DEFAULT '',
      added date NOT NULL,
      capacity bigint(20) unsigned NOT NULL DEFAULT 0,
      channels int(11) unsigned NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      UNIQUE KEY added (added,public_key),
      KEY public_key (public_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }

  private getCreateBlocksAuditsTableQuery(): string {
    return `CREATE TABLE IF NOT EXISTS blocks_audits (
      time timestamp NOT NULL,
      hash varchar(65) NOT NULL,
      height int(10) unsigned NOT NULL,
      missing_txs JSON NOT NULL,
      added_txs JSON NOT NULL,
      match_rate float unsigned NOT NULL,
      PRIMARY KEY (hash),
      INDEX (height)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }

  private getCreateGeoNamesTableQuery(): string {
    return `CREATE TABLE geo_names (
      id int(11) unsigned NOT NULL,
      type enum('city','country','division','continent') NOT NULL,
      names text DEFAULT NULL,
      UNIQUE KEY id (id,type),
      KEY id_2 (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }

  private getCreateBlocksPricesTableQuery(): string {
    return `CREATE TABLE IF NOT EXISTS blocks_prices (
      height int(10) unsigned NOT NULL,
      price_id int(10) unsigned NOT NULL,
      PRIMARY KEY (height),
      INDEX (price_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }

  private getCreateLNNodesSocketsTableQuery(): string {
    return `CREATE TABLE IF NOT EXISTS nodes_sockets (
      public_key varchar(66) NOT NULL,
      socket varchar(100) NOT NULL,
      type enum('ipv4', 'ipv6', 'torv2', 'torv3', 'i2p', 'dns', 'websocket') NULL,
      UNIQUE KEY public_key_socket (public_key, socket),
      INDEX (public_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
  }

  public async $truncateIndexedData(tables: string[]) {
    const allowedTables = ['blocks', 'hashrates', 'prices'];

    try {
      for (const table of tables) {
        if (!allowedTables.includes(table)) {
          logger.debug(`Table ${table} cannot to be re-indexed (not allowed)`);
          continue;
        }

        await this.$executeQuery(`TRUNCATE ${table}`, true);
        if (table === 'hashrates') {
          await this.$executeQuery('UPDATE state set number = 0 where name = "last_hashrates_indexing"', true);
        }
        logger.notice(`Table ${table} has been truncated`);
      }
    } catch (e) {
      logger.warn(`Unable to erase indexed data`);
    }
  }
}

export default new DatabaseMigration();
