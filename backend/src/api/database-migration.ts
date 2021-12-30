import config from '../config';
import { DB } from '../database';
import logger from '../logger';

class DatabaseMigration {
  private static currentVersion = 1;
  private queryTimeout = 120000;

  constructor() { }

  public async $initializeOrMigrateDatabase(): Promise<void> {
    if (!await this.$checkIfTableExists('statistics')) {
      await this.$initializeDatabaseTables();
    }

    if (await this.$checkIfTableExists('state')) {
      const databaseSchemaVersion = await this.$getSchemaVersionFromDatabase();
      if (DatabaseMigration.currentVersion > databaseSchemaVersion) {
        await this.$migrateTableSchemaFromVersion(databaseSchemaVersion);
      }
    } else {
      await this.$migrateTableSchemaFromVersion(0);
    }
  }

  private async $initializeDatabaseTables(): Promise<void> {
    const connection = await DB.pool.getConnection();
    for (const query of this.getInitializeTableQueries()) {
      await connection.query<any>({ sql: query, timeout: this.queryTimeout });
    }
    connection.release();
    logger.info(`Initial database tables have been created`);
  }

  private async $migrateTableSchemaFromVersion(version: number): Promise<void> {
    const connection = await DB.pool.getConnection();
    for (const query of this.getMigrationQueriesFromVersion(version)) {
      await connection.query<any>({ sql: query, timeout: this.queryTimeout });
    }
    connection.release();
    await this.$updateToLatestSchemaVersion();
    logger.info(`Database schema have been migrated from version ${version} to ${DatabaseMigration.currentVersion} (latest version)`);
  }

  private async $getSchemaVersionFromDatabase(): Promise<number> {
    const connection = await DB.pool.getConnection();
    const query = `SELECT number FROM state WHERE name = 'schema_version';`;
    const [rows] = await connection.query<any>({ sql: query, timeout: this.queryTimeout });
    connection.release();
    return rows[0]['number'];
  }

  private async $updateToLatestSchemaVersion(): Promise<void> {
    const connection = await DB.pool.getConnection();
    const query = `UPDATE state SET number = ${DatabaseMigration.currentVersion} WHERE name = 'schema_version'`;
    const [rows] = await connection.query<any>({ sql: query, timeout: this.queryTimeout });
    connection.release();
  }

  private async $checkIfTableExists(table: string): Promise<boolean> {
    const connection = await DB.pool.getConnection();
    const query = `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${config.DATABASE.DATABASE}' AND TABLE_NAME = '${table}'`;
    const [rows] = await connection.query<any>({ sql: query, timeout: this.queryTimeout });
    connection.release();
    return rows[0]['COUNT(*)'] === 1;
  }

  private getInitializeTableQueries(): string[] {
    const queries: string[] = [];

    queries.push(`CREATE TABLE IF NOT EXISTS statistics (
      id int(11) NOT NULL,
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
      vsize_2000 int(11) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`);

    queries.push(`ALTER TABLE statistics ADD PRIMARY KEY (id);`);
    queries.push(`ALTER TABLE statistics MODIFY id int(11) NOT NULL AUTO_INCREMENT;`);

    return queries;
  }

  private getMigrationQueriesFromVersion(version: number): string[] {
    const queries: string[] = [];

    if (version < 1) {
      if (config.MEMPOOL.NETWORK !== 'liquid' && config.MEMPOOL.NETWORK !== 'liquidtestnet') {
        queries.push(`UPDATE statistics SET
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
          vsize_1400 = vsize_1800, vsize_1800 = vsize_2000, vsize_2000 = 0`);
      }

      queries.push(`CREATE TABLE IF NOT EXISTS elements_pegs (
        block int(11) NOT NULL,
        datetime int(11) NOT NULL,
        amount bigint(20) NOT NULL,
        txid varchar(65) NOT NULL,
        txindex int(11) NOT NULL,
        bitcoinaddress varchar(100) NOT NULL,
        bitcointxid varchar(65) NOT NULL,
        bitcoinindex int(11) NOT NULL,
        final_tx int(11) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`);

      queries.push(`CREATE TABLE IF NOT EXISTS state (
        name varchar(25) NOT NULL,
        number int(11) NULL,
        string varchar(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`);

      queries.push(`INSERT INTO state VALUES('schema_version', 0, NULL);`);
      queries.push(`INSERT INTO state VALUES('last_elements_block', 0, NULL);`);
    }

    return queries;
  }
}

export default new DatabaseMigration();
