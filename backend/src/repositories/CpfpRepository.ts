import DB from '../database';
import logger from '../logger';
import { Ancestor } from '../mempool.interfaces';

class CpfpRepository {
  public async $saveCluster(height: number, txs: Ancestor[], effectiveFeePerVsize: number): Promise<void> {
    try {
      const txsJson = JSON.stringify(txs);
      await DB.query(
        `
          INSERT INTO cpfp_clusters(root, height, txs, fee_rate)
          VALUE (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            height = ?,
            txs = ?,
            fee_rate = ?
        `,
        [txs[0].txid, height, txsJson, effectiveFeePerVsize, height, txsJson, effectiveFeePerVsize, height]
      );
    } catch (e: any) {
      logger.err(`Cannot save cpfp cluster into db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $deleteClustersFrom(height: number): Promise<void> {
    logger.info(`Delete newer cpfp clusters from height ${height} from the database`);
    try {
      await DB.query(
        `
          DELETE from cpfp_clusters
          WHERE height >= ?
        `,
        [height]
      );
    } catch (e: any) {
      logger.err(`Cannot delete cpfp clusters from db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }
}

export default new CpfpRepository();