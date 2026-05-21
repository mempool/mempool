import DB from '../database';
import logger from '../logger';
import { Ancestor, CpfpCluster, CpfpInfo, TemplateAlgorithm } from '../mempool.interfaces';
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
          if (cluster.templateAlgorithm === TemplateAlgorithm.clusterMempool && cluster.clusterData) {
            return this.convertCpfpCM(txid, cluster);
          }
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

  private convertCpfpCM(txid: string, cluster: CpfpCluster): CpfpInfo {
    const clusterData = cluster.clusterData;
    if (!clusterData) {
      return { ancestors: [], descendants: [], effectiveFeePerVsize: 0 };
    }

    // Find which chunk this tx belongs to
    let txFlatIdx = -1;
    let txChunkIndex = -1;
    for (let i = 0; i < clusterData.txs.length; i++) {
      if (clusterData.txs[i].txid === txid) {
        txFlatIdx = i;
        break;
      }
    }

    // Find the chunk containing this tx
    for (let chunkIdx = 0; chunkIdx < clusterData.chunks.length; chunkIdx++) {
      if (clusterData.chunks[chunkIdx].txs.includes(txFlatIdx)) {
        txChunkIndex = chunkIdx;
        break;
      }
    }

    // Derive ancestors/descendants from in-chunk depgraph parents
    // For CM, ancestors are the tx's depgraph parents within the cluster,
    // descendants are txs that depend on this tx
    const ancestors: Ancestor[] = [];
    const descendants: Ancestor[] = [];

    if (txFlatIdx >= 0) {
      // Build child map
      const childMap = new Map<number, number[]>();
      for (let i = 0; i < clusterData.txs.length; i++) {
        for (const parentIdx of clusterData.txs[i].parents) {
          let children = childMap.get(parentIdx);
          if (!children) {
            children = [];
            childMap.set(parentIdx, children);
          }
          children.push(i);
        }
      }

      const ancestorSet = new Set<number>();
      const stack = [...clusterData.txs[txFlatIdx].parents];
      while (stack.length) {
        const idx = stack.pop();
        if (idx === undefined || ancestorSet.has(idx)) {
          continue;
        }
        ancestorSet.add(idx);
        stack.push(...clusterData.txs[idx].parents);
      }

      const descendantSet = new Set<number>();
      const dStack = [...(childMap.get(txFlatIdx) || [])];
      while (dStack.length) {
        const idx = dStack.pop();
        if (idx === undefined || descendantSet.has(idx)) {
          continue;
        }
        descendantSet.add(idx);
        dStack.push(...(childMap.get(idx) || []));
      }

      for (const idx of ancestorSet) {
        const tx = clusterData.txs[idx];
        ancestors.push({ txid: tx.txid, weight: tx.weight, fee: tx.fee });
      }
      for (const idx of descendantSet) {
        const tx = clusterData.txs[idx];
        descendants.push({ txid: tx.txid, weight: tx.weight, fee: tx.fee });
      }
    }

    const effectiveFeePerVsize = txChunkIndex >= 0 ? clusterData.chunks[txChunkIndex].feerate : 0;

    return {
      ancestors,
      descendants,
      effectiveFeePerVsize,
      cluster: {
        ...clusterData,
        chunkIndex: txChunkIndex,
      },
    };
  }
}

export default new TransactionRepository();

