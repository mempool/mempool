import DB from '../database';
import logger from '../logger';
import { AuditSummary } from '../mempool.interfaces';
import blocksAuditsRepository from '../repositories/BlocksAuditsRepository';
import blocksSummariesRepository from '../repositories/BlocksSummariesRepository';
import { $sync } from './replicator';
import config from '../config';
import { Common } from '../api/common';
import blocks from '../api/blocks';

const BATCH_SIZE = 16;

/**
 * Syncs missing block template and audit data from trusted servers
 */
class AuditReplication {
  inProgress: boolean = false;
  skip: Set<string> = new Set();

  public async $sync(): Promise<void> {
    if (!config.REPLICATION.ENABLED || !config.REPLICATION.AUDIT) {
      // replication not enabled
      return;
    }
    if (this.inProgress) {
      logger.info(`AuditReplication sync already in progress`, 'Replication');
      return;
    }
    this.inProgress = true;

    const missingAudits = await this.$getMissingAuditBlocks();

    logger.debug(`Fetching missing audit data for ${missingAudits.length} blocks from trusted servers`, 'Replication');

    let totalSynced = 0;
    let totalMissed = 0;
    let loggerTimer = Date.now();
    // process missing audits in batches of BATCH_SIZE
    for (let i = 0; i < missingAudits.length; i += BATCH_SIZE) {
      const slice = missingAudits.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(slice.map(hash => this.$syncAudit(hash)));
      const synced = results.reduce((total, status) => status ? total + 1 : total, 0);
      totalSynced += synced;
      totalMissed += (slice.length - synced);
      if (Date.now() - loggerTimer > 10000) {
        loggerTimer = Date.now();
        logger.info(`Found ${totalSynced} / ${totalSynced + totalMissed} of ${missingAudits.length} missing audits`, 'Replication');
      }
      await Common.sleep$(1000);
    }

    logger.debug(`Fetched ${totalSynced} audits, ${totalMissed} still missing`, 'Replication');

    this.inProgress = false;
  }

  private async $syncAudit(hash: string): Promise<boolean> {
    if (this.skip.has(hash)) {
      // we already know none of our trusted servers have this audit
      return false;
    }

    let success = false;
    // start with a random server so load is uniformly spread
    const syncResult = await $sync(`/api/v1/block/${hash}/audit-summary`);
    if (syncResult) {
      if (syncResult.data?.template?.length) {
        await this.$saveAuditData(hash, syncResult.data);
        logger.info(`Imported audit data from ${syncResult.server} for block ${syncResult.data.height} (${hash})`);
        success = true;
      }
      if (!syncResult.data && !syncResult.exists) {
        this.skip.add(hash);
      }
    }

    return success;
  }

  private async $getMissingAuditBlocks(): Promise<string[]> {
    try {
      const startHeight = config.REPLICATION.AUDIT_START_HEIGHT || 0;
      const [rows]: any[] = await DB.query(`
        SELECT auditable.hash, auditable.height
        FROM (
          SELECT hash, height
          FROM blocks
          WHERE height >= ?
        ) AS auditable
        LEFT JOIN blocks_audits ON auditable.hash = blocks_audits.hash
        WHERE blocks_audits.hash IS NULL
        ORDER BY auditable.height DESC
      `, [startHeight]);
      return rows.map(row => row.hash);
    } catch (e: any) {
      logger.err(`Cannot fetch missing audit blocks from db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  private async $saveAuditData(blockHash: string, auditSummary: AuditSummary): Promise<void> {
    // save audit & template to DB
    await blocksSummariesRepository.$saveTemplate({
      height: auditSummary.height,
      template: {
        id: blockHash,
        transactions: auditSummary.template || []
      },
      version: 1,
    });
    await blocksAuditsRepository.$saveAudit({
      version: auditSummary.version || 0,
      hash: blockHash,
      height: auditSummary.height,
      time: auditSummary.timestamp || auditSummary.time,
      unseenTxs: auditSummary.unseenTxs || [],
      missingTxs: auditSummary.missingTxs || [],
      addedTxs: auditSummary.addedTxs || [],
      prioritizedTxs: auditSummary.prioritizedTxs || [],
      freshTxs: auditSummary.freshTxs || [],
      sigopTxs: auditSummary.sigopTxs || [],
      fullrbfTxs: auditSummary.fullrbfTxs || [],
      acceleratedTxs: auditSummary.acceleratedTxs || [],
      matchRate: auditSummary.matchRate,
      expectedFees: auditSummary.expectedFees,
      expectedWeight: auditSummary.expectedWeight,
    });
    // add missing data to cached blocks
    const cachedBlock = blocks.getBlocks().find(block => block.id === blockHash);
    if (cachedBlock) {
      cachedBlock.extras.matchRate = auditSummary.matchRate;
      cachedBlock.extras.expectedFees = auditSummary.expectedFees || null;
      cachedBlock.extras.expectedWeight = auditSummary.expectedWeight || null;
    }
  }
}

export default new AuditReplication();

