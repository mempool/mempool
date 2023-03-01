import config from '../config';
import logger from '../logger';
import { Common } from './common';
import databaseMigration from './database-migration';

const isBitcoin = ['mainnet', 'testnet', 'signet'].includes(config.MEMPOOL.NETWORK);

/**
 * Rollback the database schema to versionTarget
 * !!! NON PERMANENT DATA WILL BE LOST !!!
 * 
 * @param versionTarget 
 */
export async function rollbackDbToVersion(versionTarget: number): Promise<void> {
  if (versionTarget < 40) {
    return logger.err(`We currently do no support rolling back db schema to a version lower than 40`);
  }

  logger.debug(`MIGRATIONS: Rolling back db schema to version ${versionTarget}`);
  await databaseMigration.$printDatabaseVersion();

  // If the `state` table does not exist, abort
  if (!await databaseMigration.$checkIfTableExists('state')) {
    return logger.debug(`MIGRATIONS: 'state' table does not exist. Cannot rollback because we don't know the current db schema version`);
  }

  let databaseSchemaVersion = 0;
  try {
    databaseSchemaVersion = await databaseMigration.$getSchemaVersionFromDatabase();
  } catch (e) {
    return logger.err(`MIGRATIONS: Unable to get current database migration version, aborting. Reason: ${e instanceof Error ? e.message : e}`);
  }

  if (databaseSchemaVersion === versionTarget) {
    return logger.info(`Current database schema is already on version ${databaseSchemaVersion}. Nothing to rollback`);
  }

  logger.warn(`Your database is currently on schema version ${databaseSchemaVersion} and will be rolled back to version ${versionTarget}`);
  logger.warn(`!!! ALL NON PERMANENT DATA WILL BE LOST !!! You can safely abort by killing this script within 10 seconds from now`);
  await Common.sleep$(10000);

  logger.warn(`Now rolling back database to version ${versionTarget}`);

  let currentVersion = databaseSchemaVersion;
  while (currentVersion > versionTarget) {
    const methodName = `rollback${currentVersion}`;
    if (methods[methodName] === undefined) {
      logger.info(`There is no rollback function for version ${currentVersion}`);
    } else {
      logger.info(`Rolling back db migration ${currentVersion}`);
      await methods[`rollback${currentVersion}`]();
    }
    --currentVersion;
  }
}

const methods = [];

methods['rollback57'] = async function (): Promise<void> {
  if (isBitcoin === true) {
    await databaseMigration.$executeQuery(`ALTER TABLE nodes MODIFY updated_at datetime NOT NULL`);
  }
  await databaseMigration.updateToSchemaVersion(56);
};

methods['rollback56'] = async function (): Promise<void> {
  await databaseMigration.$executeQuery(`ALTER TABLE pools DROP COLUMN IF EXISTS unique_id`);
  await databaseMigration.updateToSchemaVersion(55);
};

methods['rollback55'] = async function (): Promise<void> {
  await databaseMigration.$executeQuery(`ALTER TABLE blocks
    DROP COLUMN IF EXISTS median_timestamp,
    DROP COLUMN IF EXISTS coinbase_address,
    DROP COLUMN IF EXISTS coinbase_signature,
    DROP COLUMN IF EXISTS coinbase_signature_ascii,
    DROP COLUMN IF EXISTS avg_tx_size,
    DROP COLUMN IF EXISTS total_inputs,
    DROP COLUMN IF EXISTS total_outputs,
    DROP COLUMN IF EXISTS total_output_amt,
    DROP COLUMN IF EXISTS fee_percentiles,
    DROP COLUMN IF EXISTS median_fee_amt,
    DROP COLUMN IF EXISTS segwit_total_txs,
    DROP COLUMN IF EXISTS segwit_total_size,
    DROP COLUMN IF EXISTS segwit_total_weight,
    DROP COLUMN IF EXISTS header,
    DROP COLUMN IF EXISTS utxoset_change,
    DROP COLUMN IF EXISTS utxoset_size,
    DROP COLUMN IF EXISTS total_input_amt
  `);
  await databaseMigration.updateToSchemaVersion(54);
};

methods['rollback54'] = async function (): Promise<void> {
  // Nothing to do
  await databaseMigration.updateToSchemaVersion(53);
};

methods['rollback53'] = async function (): Promise<void> {
  await databaseMigration.$executeQuery('ALTER TABLE statistics MODIFY mempool_byte_weight int(10) UNSIGNED NOT NULL');
  await databaseMigration.updateToSchemaVersion(52);
};

methods['rollback52'] = async function (): Promise<void> {
  logger.warn(`!!! CPFP data will be lost !!! You can safely abort by killing this script within 10 seconds from now`);
  await Common.sleep$(10000);

  await databaseMigration.$executeQuery(databaseMigration.getCreateCPFPTableQuery());
  await databaseMigration.$executeQuery(databaseMigration.getCreateTransactionsTableQuery());
  await databaseMigration.$executeQuery('DROP TABLE IF EXISTS compact_cpfp_clusters');
  await databaseMigration.$executeQuery('DROP TABLE IF EXISTS compact_transactions');
  await databaseMigration.updateToSchemaVersion(51);
};

methods['rollback51'] = async function (): Promise<void> {
  await databaseMigration.$executeQuery('ALTER TABLE IF EXISTS `cpfp_clusters` DROP INDEX IF EXISTS `height`');
  await databaseMigration.updateToSchemaVersion(50);
};

methods['rollback50'] = async function (): Promise<void> {
  await databaseMigration.$executeQuery('ALTER TABLE `blocks` ADD cpfp_indexed tinyint(1) DEFAULT 0');
  await databaseMigration.updateToSchemaVersion(49);
};

methods['rollback49'] = async function (): Promise<void> {
  // Nothing to do
  await databaseMigration.updateToSchemaVersion(48);
};

methods['rollback48'] = async function rollback48(): Promise<void> {
  if (isBitcoin === true) {
    await databaseMigration.$executeQuery('ALTER TABLE `channels` DROP COLUMN IF EXISTS source_checked');
    await databaseMigration.$executeQuery('ALTER TABLE `channels` DROP COLUMN IF EXISTS closing_fee');
    await databaseMigration.$executeQuery('ALTER TABLE `channels` DROP COLUMN IF EXISTS node1_funding_balance');
    await databaseMigration.$executeQuery('ALTER TABLE `channels` DROP COLUMN IF EXISTS node2_funding_balance');
    await databaseMigration.$executeQuery('ALTER TABLE `channels` DROP COLUMN IF EXISTS node1_closing_balance');
    await databaseMigration.$executeQuery('ALTER TABLE `channels` DROP COLUMN IF EXISTS node2_closing_balance');
    await databaseMigration.$executeQuery('ALTER TABLE `channels` DROP COLUMN IF EXISTS funding_ratio');
    await databaseMigration.$executeQuery('ALTER TABLE `channels` DROP COLUMN IF EXISTS closed_by');
    await databaseMigration.$executeQuery('ALTER TABLE `channels` DROP COLUMN IF EXISTS single_funded');
    await databaseMigration.$executeQuery('ALTER TABLE `channels` DROP COLUMN IF EXISTS outputs');
  }
  await databaseMigration.updateToSchemaVersion(47);
};

methods['rollback47'] = async function (): Promise<void> {
  await databaseMigration.$executeQuery('DROP TABLE IF EXISTS transactions');
  await databaseMigration.$executeQuery('DROP TABLE IF EXISTS cpfp_clusters');
  await databaseMigration.$executeQuery('ALTER TABLE `blocks` DROP COLUMN IF EXISTS cpfp_indexed');
  await databaseMigration.updateToSchemaVersion(46);
};

methods['rollback46'] = async function (): Promise<void> {
  await databaseMigration.$executeQuery('ALTER TABLE blocks MODIFY blockTimestamp timestamp NOT NULL');
  await databaseMigration.updateToSchemaVersion(45);
};

methods['rollback45'] = async function (): Promise<void> {
  if (isBitcoin === true) {
    await databaseMigration.$executeQuery('ALTER TABLE `blocks_audits` DROP COLUMN IF EXISTS fresh_txs');
  }
  await databaseMigration.updateToSchemaVersion(44);
};

methods['rollback44'] = async function (): Promise<void> {
  // Nothing to do
  await databaseMigration.updateToSchemaVersion(43);
};

methods['rollback43'] = async function (): Promise<void> {
  if (isBitcoin === true) {
    await databaseMigration.$executeQuery(`DROP TABLE IF EXISTS nodes_records`);
  }
  await databaseMigration.updateToSchemaVersion(42);
};

methods['rollback42'] = async function (): Promise<void> {
  if (isBitcoin === true) {
    await databaseMigration.$executeQuery('ALTER TABLE `channels` DROP COLUMN IF EXISTS closing_resolved');
  }
  await databaseMigration.updateToSchemaVersion(41);
};

methods['rollback41'] = async function (): Promise<void> {
  // Nothing to do
  await databaseMigration.updateToSchemaVersion(40);
};

rollbackDbToVersion(parseInt(process.argv[2], 10)).then(() => process.exit());