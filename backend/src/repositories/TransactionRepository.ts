import DB from '../database';
import logger from '../logger';
import { Ancestor, CpfpInfo } from '../mempool.interfaces';
import cpfpRepository from './CpfpRepository';

class TransactionRepository {
  public async $setCluster(txid: string, clusterRoot: string): Promise<void> {
    try {
      await DB.query(
        `
          INSERT INTO compact_transactions
          (
            txid,
            cluster
          )
          VALUE (UNHEX(?), UNHEX(?))
          ON DUPLICATE KEY UPDATE
            cluster = UNHEX(?)
        ;`,
        [txid, clusterRoot, clusterRoot]
      );
    } catch (e: any) {
      logger.err(`Cannot save transaction cpfp cluster into db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public buildBatchSetQuery(txs: { txid: string, cluster: string }[]): { query, params } {
    let query = `
          INSERT IGNORE INTO compact_transactions
          (
            txid,
            cluster
          )
          VALUES
      `;
    query += txs.map(tx => {
      return (' (UNHEX(?), UNHEX(?))');
    }) + ';';
    const values = txs.map(tx => [tx.txid, tx.cluster]).flat();
    return {
      query,
      params: values,
    };
  }

  public async $batchSetCluster(txs): Promise<void> {
    try {
      const query = this.buildBatchSetQuery(txs);
      await DB.query(
        query.query,
        query.params,
      );
    } catch (e: any) {
      logger.err(`Cannot save cpfp transactions into db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getCpfpInfo(txid: string): Promise<CpfpInfo | void> {
    try {
      const [txRows]: any = await DB.query(
        `
          SELECT HEX(txid) as id, HEX(cluster) as root
          FROM compact_transactions
          WHERE txid = UNHEX(?)
        `,
        [txid]
      );
      if (txRows.length && txRows[0].root != null) {
        const txid = txRows[0].id.toLowerCase();
        const clusterId = txRows[0].root.toLowerCase();
        const cluster = await cpfpRepository.$getCluster(clusterId);
        if (cluster) {
          return this.convertCpfp(txid, cluster);
        }
      }
    } catch (e) {
      logger.err('Cannot get transaction cpfp info from db. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $removeTransaction(txid: string): Promise<void> {
    try {
      await DB.query(
        `
          DELETE FROM compact_transactions
          WHERE txid = UNHEX(?)
        `,
        [txid]
      );
    } catch (e) {
      logger.warn('Cannot delete transaction cpfp info from db. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  private convertCpfp(txid, cluster): CpfpInfo {
    const descendants: Ancestor[] = [];
    const ancestors: Ancestor[] = [];
    let matched = false;

    for (const tx of (cluster?.txs || [])) {
      if (tx.txid === txid) {
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
      effectiveFeePerVsize: cluster.effectiveFeePerVsize,
    };
  }
}

export default new TransactionRepository();

