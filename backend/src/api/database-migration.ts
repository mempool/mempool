import { PoolConnection } from 'mysql2/promise';
import config from '../config';
import { DB } from '../database';
import logger from '../logger';

class DatabaseMigration {
  private static currentVersion = 2;
  private queryTimeout = 120000;

  constructor() { }

  /**
   * Entry point
   */
  public async $initializeOrMigrateDatabase(): Promise<void> {
    logger.info("MIGRATIONS: Running migrations");

    // First of all, if the `state` database does not exist, create it so we can track migration version
    if (!await this.$checkIfTableExists('state')) {
      logger.info("MIGRATIONS: `state` table does not exist. Creating it.")
      try {
        await this.$createMigrationStateTable();
      } catch (e) {
        logger.err("Unable to create `state` table. Aborting migration. Error: " + e);
        process.exit(-1);
      }
      logger.info("MIGRATIONS: `state` table initialized.")
    }

    let databaseSchemaVersion = 0;
    try {
      databaseSchemaVersion = await this.$getSchemaVersionFromDatabase();
    } catch (e) {
      logger.err("Unable to get current database migration version, aborting. Error: " + e);
      process.exit(-1);
    }

    logger.info("MIGRATIONS: Current state.schema_version " + databaseSchemaVersion.toString());
    logger.info("MIGRATIONS: Latest DatabaseMigration.version is " + DatabaseMigration.currentVersion.toString());
    if (databaseSchemaVersion.toString() === DatabaseMigration.currentVersion.toString()) {
      logger.info("MIGRATIONS: Nothing to do.");
      return;
    }

    if (DatabaseMigration.currentVersion > databaseSchemaVersion) {
      logger.info("MIGRATIONS: Upgrading datababse schema");
      try {
        await this.$migrateTableSchemaFromVersion(databaseSchemaVersion);
        logger.info(`OK. Database schema have been migrated from version ${databaseSchemaVersion} to ${DatabaseMigration.currentVersion} (latest version)`);
      } catch (e) {
        logger.err("Unable to migrate database, aborting. Error: " + e);
      }
    }

    return;
  }

  /**
   * Small query execution wrapper to log all executed queries
   */
  private async $executeQuery(connection: PoolConnection, query: string): Promise<any> {
    logger.info("MIGRATIONS: Execute query:\n" + query);
    return connection.query<any>({ sql: query, timeout: this.queryTimeout });
  }

  /**
   * Check if 'table' exists in the database
   */
  private async $checkIfTableExists(table: string): Promise<boolean> {
    const connection = await DB.pool.getConnection();
    const query = `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${config.DATABASE.DATABASE}' AND TABLE_NAME = '${table}'`;
    const [rows] = await connection.query<any>({ sql: query, timeout: this.queryTimeout });
    connection.release();
    return rows[0]['COUNT(*)'] === 1;
  }

  /**
   * Get current database version
   */
  private async $getSchemaVersionFromDatabase(): Promise<number> {
    const connection = await DB.pool.getConnection();
    const query = `SELECT number FROM state WHERE name = 'schema_version';`;
    const [rows] = await connection.query<any>({ sql: query, timeout: this.queryTimeout });
    connection.release();
    return rows[0]['number'];
  }

  /**
   * Create the `state` table
   */
  private async $createMigrationStateTable(): Promise<void> {
    const connection = await DB.pool.getConnection();
    await this.$executeQuery(connection, `START TRANSACTION;`);
    await this.$executeQuery(connection, "SET autocommit = 0;");

    try {
      const query = `CREATE TABLE IF NOT EXISTS state (
        name varchar(25) NOT NULL,
        number int(11) NULL,
        string varchar(100) NULL,
        CONSTRAINT name_unique UNIQUE (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
      await this.$executeQuery(connection, query);

      // Set initial values
      await this.$executeQuery(connection, `INSERT INTO state VALUES('schema_version', 0, NULL);`);
      await this.$executeQuery(connection, `INSERT INTO state VALUES('last_elements_block', 0, NULL);`);
    } catch (e) {
      await this.$executeQuery(connection, `ROLLBACK;`);
      connection.release();
      throw e;
    }

    await this.$executeQuery(connection, `COMMIT;`);
  }

  /**
   * We actually run the migrations queries here
   */
  private async $migrateTableSchemaFromVersion(version: number): Promise<void> {
    let transactionQueries: string[] = [];
    for (const query of this.getMigrationQueriesFromVersion(version)) {
      transactionQueries.push(query);
    }
    transactionQueries.push(this.getUpdateToLatestSchemaVersionQuery());

    const connection = await DB.pool.getConnection();
    try {
      await this.$executeQuery(connection, "START TRANSACTION;");
      await this.$executeQuery(connection, "SET autocommit = 0;");
      for (const query of transactionQueries) {
        await this.$executeQuery(connection, query);
      }
    } catch (e) {
      await this.$executeQuery(connection, "ROLLBACK;");
      connection.release();
      throw e;
    }

    await this.$executeQuery(connection, "COMMIT;");
  }

  /**
   * Generate migration queries based on schema version
   */
  private getMigrationQueriesFromVersion(version: number): string[] {
    const queries: string[] = [];

    if (version < 1) {
      queries.push(this.getCreateElementsTableQuery());
      queries.push(this.getCreateStatisticsQuery());
      if (config.MEMPOOL.NETWORK !== 'liquid' && config.MEMPOOL.NETWORK !== 'liquidtestnet') {
        queries.push(this.getUpdateStatisticsQuery());
      }
    }

    if (version < 2) {
      queries.push(`CREATE INDEX IF NOT EXISTS added ON statistics (added);`);
    }

    return queries;
  }

  /**
   * Save the schema version in the database
   */
   private getUpdateToLatestSchemaVersionQuery(): string {
    return `UPDATE state SET number = ${DatabaseMigration.currentVersion} WHERE name = 'schema_version';`;
  }

  // Couple of wrappers to clean the main logic
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`
  }
  private getUpdateStatisticsQuery(): string {
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`
  }
}

export default new DatabaseMigration();
