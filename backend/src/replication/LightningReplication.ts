import DB from '../database';
import logger from '../logger';
import config from '../config';
import { $sync } from './replicator';

interface LightningStatistic {
  added: number;
  channel_count: number;
  total_capacity: number;
  tor_nodes: number;
  clearnet_nodes: number;
  unannounced_nodes: number;
  clearnet_tor_nodes: number;
  avg_capacity: number;
  avg_fee_rate: number;
  avg_base_fee_mtokens: number;
  med_capacity: number;
  med_fee_rate: number;
  med_base_fee_mtokens: number;
}

const DAY = 86400;
const MAX_EMPTINESS = 0.25;
const MAX_POLLUTION = 0.1;
const MAX_DEVIATION = 0.1;

/**
 * Syncs missing daily lightning network statistics from trusted servers
 */
class LightningReplication {
  inProgress: boolean = false;

  /** @asyncSafe */
  public async $sync(): Promise<void> {
    if (!config.REPLICATION.ENABLED || !config.REPLICATION.LIGHTNING || !config.LIGHTNING.ENABLED) {
      return;
    }
    if (this.inProgress) {
      logger.info(`LightningReplication sync already in progress`, 'Replication');
      return;
    }
    this.inProgress = true;

    try {
      const syncResult = await $sync('/api/v1/lightning/statistics/all', this.performSanityCheck.bind(this));
      if (!syncResult.data?.length) {
        logger.warn(`Could not get agreeing lightning statistics from trusted servers`, 'Replication');
        return;
      }

      const existingDays = await this.$getExistingDays();
      const today = this.toDay(Date.now() / 1000);
      let synced = 0;

      for (const stat of syncResult.data as LightningStatistic[]) {
        const day = this.toDay(stat.added);
        if (day >= today || existingDays.has(day)) {
          continue;
        }
        await this.$saveStatistic(stat, day * DAY);
        existingDays.add(day);
        synced++;
      }

      logger.info(`Synced ${synced} lightning statistics rows from ${syncResult.server}`, 'Replication');
    } catch (e) {
      logger.err(`Lightning statistics replication failed. Reason: ` + (e instanceof Error ? e.message : e), 'Replication');
    } finally {
      this.inProgress = false;
    }
  }

  private performSanityCheck(resultsPerServer: Record<string, LightningStatistic[]>, path: string): { serverPicked: string, sanitizedResult: LightningStatistic[] } {
    const servers = Object.keys(resultsPerServer);
    const days: Map<number, LightningStatistic>[] = [];
    for (const server of servers) {
      days.push(this.mapByDay(resultsPerServer[server]));
    }

    logger.info(`Performing sanity check for lightning stats among ${servers.length} servers for ${path}`, 'Replication');

    const agreements: number[] = new Array(servers.length).fill(0);
    for (let i = 0; i < servers.length; i++) {
      for (let j = i + 1; j < servers.length; j++) {
        if (this.resultsAgree(days[i], days[j])) {
          agreements[i]++;
          agreements[j]++;
        }
      }
    }

    let best = 0;
    for (let i = 1; i < servers.length; i++) {
      if (agreements[i] > agreements[best]) {
        best = i;
      }
    }

    if (!servers.length || agreements[best] < Math.floor(servers.length / 2)) {
      logger.err(`No majority agreement among ${servers.length} servers for ${path}`, 'Replication');
      return { serverPicked: '', sanitizedResult: [] };
    }

    logger.info(`Best server after performing sanity check: ${servers[best]} for ${path}`, 'Replication');
    return { serverPicked: servers[best], sanitizedResult: resultsPerServer[servers[best]] };
  }

  private resultsAgree(days1: Map<number, LightningStatistic>, days2: Map<number, LightningStatistic>): boolean {
    const longest = Math.max(days1.size, days2.size);
    let shared = 0;
    let polluted = 0;

    for (const [day, stat1] of days1) {
      const stat2 = days2.get(day);
      if (!stat2) {
        continue;
      }
      shared++;
      if (this.deviates(stat1, stat2)) {
        polluted++;
      }
    }

    if (shared === 0 || (longest - shared) / longest > MAX_EMPTINESS) {
      return false;
    }
    return polluted <= Math.floor(shared * MAX_POLLUTION);
  }

  private deviates(stat1: LightningStatistic, stat2: LightningStatistic): boolean {
    return this.differs(stat1.channel_count, stat2.channel_count)
      || this.differs(stat1.total_capacity, stat2.total_capacity)
      || this.differs(this.nodeCount(stat1), this.nodeCount(stat2))
      || this.nodeTypeDistance(stat1, stat2) > MAX_DEVIATION
      || this.differs(stat1.avg_capacity, stat2.avg_capacity)
      || this.differs(stat1.avg_fee_rate, stat2.avg_fee_rate)
      || this.differs(stat1.avg_base_fee_mtokens, stat2.avg_base_fee_mtokens)
      || this.differs(stat1.med_capacity, stat2.med_capacity)
      || this.differs(stat1.med_fee_rate, stat2.med_fee_rate)
      || this.differs(stat1.med_base_fee_mtokens, stat2.med_base_fee_mtokens);
  }

  private nodeTypeDistance(stat1: LightningStatistic, stat2: LightningStatistic): number {
    const total1 = this.nodeCount(stat1);
    const total2 = this.nodeCount(stat2);
    if (!total1 || !total2) {
      return 0;
    }
    return (Math.abs(stat1.tor_nodes / total1 - stat2.tor_nodes / total2)
      + Math.abs(stat1.clearnet_nodes / total1 - stat2.clearnet_nodes / total2)
      + Math.abs(stat1.unannounced_nodes / total1 - stat2.unannounced_nodes / total2)
      + Math.abs(stat1.clearnet_tor_nodes / total1 - stat2.clearnet_tor_nodes / total2)) / 2;
  }

  private differs(value1: number, value2: number): boolean {
    return Math.abs(value1 - value2) > Math.max(value1, value2) * MAX_DEVIATION;
  }

  private nodeCount(stat: LightningStatistic): number {
    return stat.tor_nodes + stat.clearnet_nodes + stat.unannounced_nodes + stat.clearnet_tor_nodes;
  }

  private mapByDay(stats: LightningStatistic[]): Map<number, LightningStatistic> {
    const days = new Map<number, LightningStatistic>();
    if (!Array.isArray(stats)) {
      return days;
    }
    for (const stat of stats) {
      if (!this.isValid(stat)) {
        return new Map();
      }
      const day = this.toDay(stat.added);
      if (!days.has(day)) {
        days.set(day, stat);
      }
    }
    return days;
  }

  private isValid(stat: LightningStatistic): boolean {
    return stat && typeof stat === 'object'
      && stat.added !== null
      && Number.isFinite(Number(stat.added))
      && Number.isFinite(stat.channel_count)
      && Number.isFinite(stat.total_capacity)
      && Number.isFinite(stat.tor_nodes)
      && Number.isFinite(stat.clearnet_nodes)
      && Number.isFinite(stat.unannounced_nodes)
      && Number.isFinite(stat.clearnet_tor_nodes)
      && Number.isFinite(stat.avg_capacity)
      && Number.isFinite(stat.avg_fee_rate)
      && Number.isFinite(stat.avg_base_fee_mtokens)
      && Number.isFinite(stat.med_capacity)
      && Number.isFinite(stat.med_fee_rate)
      && Number.isFinite(stat.med_base_fee_mtokens);
  }

  private toDay(timestamp: number): number {
    return Math.floor(Number(timestamp) / DAY);
  }

  /** @asyncUnsafe */
  private async $getExistingDays(): Promise<Set<number>> {
    const [rows]: any[] = await DB.query(`SELECT UNIX_TIMESTAMP(added) AS added FROM lightning_stats`);
    const days = new Set<number>();
    for (const row of rows) {
      days.add(this.toDay(row.added));
    }
    return days;
  }

  /** @asyncUnsafe */
  private async $saveStatistic(stat: LightningStatistic, added: number): Promise<void> {
    await DB.query(
      `INSERT IGNORE INTO lightning_stats (
        added,              channel_count,        node_count,        
        total_capacity,     tor_nodes,            clearnet_nodes,   
        unannounced_nodes,  clearnet_tor_nodes,   avg_capacity,   
        avg_fee_rate,       avg_base_fee_mtokens, med_capacity,   
        med_fee_rate,       med_base_fee_mtokens
        )
        VALUES (
        FROM_UNIXTIME(?), ?,  ?, 
                      ?,  ?,  ?, 
                      ?,  ?,  ?, 
                      ?,  ?,  ?, 
                      ?,  ?
      )`,
      [
        added,                  stat.channel_count,       this.nodeCount(stat),
        stat.total_capacity,    stat.tor_nodes,           stat.clearnet_nodes,
        stat.unannounced_nodes, stat.clearnet_tor_nodes,  stat.avg_capacity,
        stat.avg_fee_rate,      stat.avg_base_fee_mtokens,  stat.med_capacity,
        stat.med_fee_rate,      stat.med_base_fee_mtokens
      ]
    );
  }
}

export default new LightningReplication();
