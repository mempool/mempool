import config from '../config';
import DB from '../database';
import logger from '../logger';
import { Ancestor, CpfpInfo, TransactionExtras } from '../mempool.interfaces';

interface TxInfo {
  txid: string;
  cluster: string;
  root: string;
  txs: Ancestor[];
  height: number;
  fee_rate: number;
  firstSeen: number;
}

class TransactionRepository {
  public async $setCluster(txid: string, cluster: string): Promise<void> {
    try {
      await DB.query(
        `
          INSERT INTO transactions
          (
            txid,
            cluster
          )
          VALUE (?, ?)
          ON DUPLICATE KEY UPDATE
            cluster = ?
        ;`,
        [txid, cluster, cluster]
      );
    } catch (e: any) {
      logger.err(`Cannot save transaction cpfp cluster into db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $saveTxFirstSeen(txid: string, seenAt: number) {
    try {
      await DB.query(
        `
          INSERT INTO transactions
          (
            txid,
            first_seen
          )
          VALUE (?, FROM_UNIXTIME(?))
          ON DUPLICATE KEY UPDATE
            first_seen = FROM_UNIXTIME(?)
        ;`,
        [txid, seenAt, seenAt]
      );
    } catch (e: any) {
      logger.err(`Cannot save transaction first seen time into db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getTransactionExtras(txid: string): Promise<TransactionExtras | void> {
    try {
      let query = `
        SELECT *, UNIX_TIMESTAMP(first_seen) as firstSeen
        FROM transactions
        LEFT JOIN cpfp_clusters AS cluster ON cluster.root = transactions.cluster
        WHERE transactions.txid = ?
      `;
      const [rows]: any = await DB.query(query, [txid]);
      if (rows.length) {
        rows[0].txs = JSON.parse(rows[0].txs) as Ancestor[];
        return this.convertCpfp(rows[0]);
      }
    } catch (e) {
      logger.err('Cannot get transaction cpfp info from db. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getCpfpInfo(txid: string): Promise<CpfpInfo | void> {
    try {
      let query = `
        SELECT *
        FROM transactions
        LEFT JOIN cpfp_clusters AS cluster ON cluster.root = transactions.cluster
        WHERE transactions.txid = ?
      `;
      const [rows]: any = await DB.query(query, [txid]);
      if (rows.length) {
        rows[0].txs = JSON.parse(rows[0].txs) as Ancestor[];
        if (rows[0]?.txs?.length) {
          return this.convertCpfp(rows[0]);
        }
      }
    } catch (e) {
      logger.err('Cannot get transaction cpfp info from db. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $clearOldFirstSeen() {
    if (config.MEMPOOL.FIRST_SEEN_INDEXING_DAYS > 0) {
      const cutoff = Math.floor(Date.now() / 1000) - (config.MEMPOOL.FIRST_SEEN_INDEXING_DAYS * 86400);
      await this.$clearFirstSeenBefore(cutoff);
    }
  }

  private async $clearFirstSeenBefore(cutoff: number) {
    try {
      const result = await DB.query(
        `
          DELETE FROM transactions
          WHERE cluster is null AND first_seen < FROM_UNIXTIME(?)
        ;`,
        [cutoff]
      );
    } catch (e: any) {
      logger.err(`Cannot clear old tx first seen times from db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  private convertCpfp(info: TxInfo): TransactionExtras {
    const descendants: Ancestor[] = [];
    const ancestors: Ancestor[] = [];
    let matched = false;
    for (const tx of (info.txs || [])) {
      if (tx.txid === info.txid) {
        matched = true;
      } else if (!matched) {
        descendants.push(tx);
      } else {
        ancestors.push(tx);
      }
    }
    return {
      descendants: descendants?.length ? descendants : undefined,
      ancestors: ancestors,
      effectiveFeePerVsize: info.fee_rate,
      firstSeen: info.firstSeen || undefined,
    };
  }
}

export default new TransactionRepository();

