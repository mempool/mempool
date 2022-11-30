import DB from '../database';
import logger from '../logger';
import { Ancestor, CpfpInfo } from '../mempool.interfaces';

interface CpfpSummary {
  txid: string;
  cluster: string;
  root: string;
  txs: Ancestor[];
  height: number;
  fee_rate: number;
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
        return this.convertCpfp(rows[0]);
      }
    } catch (e) {
      logger.err('Cannot get transaction cpfp info from db. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  private convertCpfp(cpfp: CpfpSummary): CpfpInfo {
    const descendants: Ancestor[] = [];
    const ancestors: Ancestor[] = [];
    let matched = false;
    for (const tx of cpfp.txs) {
      if (tx.txid === cpfp.txid) {
        matched = true;
      } else if (!matched) {
        descendants.push(tx);
      } else {
        ancestors.push(tx);
      }
    }
    return {
      descendants,
      ancestors,
      effectiveFeePerVsize: cpfp.fee_rate
    };
  }
}

export default new TransactionRepository();

