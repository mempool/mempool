import { RowDataPacket } from 'mysql2';
import DB from '../database';
import logger from '../logger';
import { Ancestor, CpfpCluster, CpfpClusterData, CpfpClusterTx, TemplateAlgorithm } from '../mempool.interfaces';
import transactionRepository from '../repositories/TransactionRepository';

class CpfpRepository {
  public async $batchSaveClusters(clusters: CpfpCluster[]): Promise<boolean> {
    try {
      const clusterValues: [string, number, Buffer, number, number][] = [];
      const txs: { txid: string, cluster: string }[] = [];

      for (const cluster of clusters) {
        if (cluster.txs?.length) {
          const isCM = cluster.templateAlgorithm === TemplateAlgorithm.clusterMempool;

          if (isCM && cluster.clusterData) {
            clusterValues.push([
              cluster.root,
              cluster.height,
              Buffer.from(this.packCM(cluster.clusterData)),
              0,
              TemplateAlgorithm.clusterMempool,
            ]);
            for (const tx of cluster.clusterData.txs) {
              txs.push({ txid: tx.txid, cluster: cluster.root });
            }
          } else {
            const roundedEffectiveFee = Math.round(cluster.effectiveFeePerVsize * 100) / 100;
            const equalFee = cluster.txs.length > 1 && cluster.txs.reduce((acc, tx) => {
              return (acc && Math.round(((tx.fee || 0) / (tx.weight / 4)) * 100) / 100 === roundedEffectiveFee);
            }, true);
            if (!equalFee) {
              clusterValues.push([
                cluster.root,
                cluster.height,
                Buffer.from(this.pack(cluster.txs)),
                cluster.effectiveFeePerVsize,
                TemplateAlgorithm.legacy,
              ]);
              for (const tx of cluster.txs) {
                txs.push({ txid: tx.txid, cluster: cluster.root });
              }
            }
          }
        }
      }

      if (!clusterValues.length) {
        return false;
      }

      const queries: { query, params }[] = [];

      const maxChunk = 100;
      let chunkIndex = 0;
      // insert clusters in batches of up to 100 rows
      while (chunkIndex < clusterValues.length) {
        const chunk = clusterValues.slice(chunkIndex, chunkIndex + maxChunk);
        let query = `
            INSERT IGNORE INTO compact_cpfp_clusters(root, height, txs, fee_rate, template_algo)
            VALUES
        `;
        query += chunk.map(chunk => {
          return (' (UNHEX(?), ?, ?, ?, ?)');
        }) + ';';
        const values = chunk.flat();
        queries.push({
          query,
          params: values,
        });
        chunkIndex += maxChunk;
      }

      chunkIndex = 0;
      // insert transactions in batches of up to 100 rows
      while (chunkIndex < txs.length) {
        const chunk = txs.slice(chunkIndex, chunkIndex + maxChunk);
        queries.push(transactionRepository.buildBatchSetQuery(chunk));
        chunkIndex += maxChunk;
      }

      await DB.$atomicQuery(queries);

      return true;
    } catch (e: any) {
      logger.err(`Cannot save cpfp clusters into db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }


  /** @asyncUnsafe */
  public async $getCluster(clusterRoot: string): Promise<CpfpCluster | void> {
    const [clusterRows]: any = await DB.query(
      `
        SELECT *
        FROM compact_cpfp_clusters
        WHERE root = UNHEX(?)
      `,
      [clusterRoot]
    );
    const cluster = clusterRows[0];
    if (cluster?.txs) {
      if (cluster.template_algo === TemplateAlgorithm.clusterMempool) {
        cluster.templateAlgorithm = TemplateAlgorithm.clusterMempool;
        cluster.clusterData = this.unpackCM(cluster.txs);
        cluster.txs = cluster.clusterData.txs.map(tx => ({ txid: tx.txid, weight: tx.weight, fee: tx.fee }));
        cluster.effectiveFeePerVsize = 0;
      } else {
        cluster.templateAlgorithm = TemplateAlgorithm.legacy;
        cluster.effectiveFeePerVsize = cluster.fee_rate;
        cluster.txs = this.unpack(cluster.txs);
      }
      return cluster;
    }
    return;
  }

  /** @asyncUnsafe */
  public async $getClustersAt(height: number): Promise<CpfpCluster[]> {
    const [clusterRows]: any = await DB.query(
      `
        SELECT *
        FROM compact_cpfp_clusters
        WHERE height = ?
      `,
      [height]
    );
    return clusterRows.map(cluster => {
      if (cluster?.txs) {
        if (cluster.template_algo === TemplateAlgorithm.clusterMempool) {
          cluster.templateAlgorithm = TemplateAlgorithm.clusterMempool;
          cluster.clusterData = this.unpackCM(cluster.txs);
          cluster.txs = cluster.clusterData.txs.map(tx => ({ txid: tx.txid, weight: tx.weight, fee: tx.fee }));
          cluster.effectiveFeePerVsize = 0;
        } else {
          cluster.templateAlgorithm = TemplateAlgorithm.legacy;
          cluster.effectiveFeePerVsize = cluster.fee_rate;
          cluster.txs = this.unpack(cluster.txs);
        }
        return cluster;
      } else {
        return null;
      }
    }).filter(cluster => cluster !== null);
  }

  public async $deleteClustersFrom(height: number): Promise<void> {
    logger.info(`Delete newer cpfp clusters from height ${height} from the database`);
    try {
      const [rows] = await DB.query(
        `
          SELECT txs, height, root, template_algo from compact_cpfp_clusters
          WHERE height >= ?
        `,
        [height]
      ) as RowDataPacket[][];
      if (rows?.length) {
        for (const clusterToDelete of rows) {
          const txids = this.extractTxids(clusterToDelete);
          for (const txid of txids) {
            await transactionRepository.$removeTransaction(txid);
          }
        }
      }
      await DB.query(
        `
          DELETE from compact_cpfp_clusters
          WHERE height >= ?
        `,
        [height]
      );
    } catch (e: any) {
      logger.err(`Cannot delete cpfp clusters from db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $deleteClustersAt(height: number): Promise<void> {
    logger.info(`Delete cpfp clusters at height ${height} from the database`);
    try {
      const [rows] = await DB.query(
        `
          SELECT txs, height, root, template_algo from compact_cpfp_clusters
          WHERE height = ?
        `,
        [height]
      ) as RowDataPacket[][];
      if (rows?.length) {
        for (const clusterToDelete of rows) {
          const txids = this.extractTxids(clusterToDelete);
          for (const txid of txids) {
            await transactionRepository.$removeTransaction(txid);
          }
        }
      }
      await DB.query(
        `
          DELETE from compact_cpfp_clusters
          WHERE height = ?
        `,
        [height]
      );
    } catch (e: any) {
      logger.err(`Cannot delete cpfp clusters from db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  private extractTxids(row: any): string[] {
    if (row.template_algo === TemplateAlgorithm.clusterMempool) {
      return this.unpackCM(row.txs).txs.map(tx => tx.txid);
    }
    return this.unpack(row.txs).map(tx => tx.txid);
  }

  // insert a dummy row to mark that we've indexed as far as this block
  public async $insertProgressMarker(height: number): Promise<void> {
    try {
      const [rows]: any = await DB.query(
        `
          SELECT root
          FROM compact_cpfp_clusters
          WHERE height = ?
        `,
        [height]
      );
      if (!rows?.length) {
        const rootBuffer = Buffer.alloc(32);
        rootBuffer.writeInt32LE(height);
        await DB.query(
          `
            INSERT INTO compact_cpfp_clusters(root, height, fee_rate)
            VALUE (?, ?, ?)
          `,
          [rootBuffer, height, 0]
        );
      }
    } catch (e: any) {
      logger.err(`Cannot insert cpfp progress marker. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public pack(txs: Ancestor[]): ArrayBuffer {
    const buf = new ArrayBuffer(44 * txs.length);
    const view = new DataView(buf);
    txs.forEach((tx, i) => {
      const offset = i * 44;
      for (let x = 0; x < 32; x++) {
        // store txid in little-endian
        view.setUint8(offset + (31 - x), parseInt(tx.txid.slice(x * 2, (x * 2) + 2), 16));
      }
      view.setUint32(offset + 32, tx.weight);
      view.setBigUint64(offset + 36, BigInt(Math.round(tx.fee)));
    });
    return buf;
  }

  public unpack(buf: Buffer): Ancestor[] {
    if (!buf) {
      return [];
    }

    try {
      const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      const txs: Ancestor[] = [];
      const view = new DataView(arrayBuffer);
      for (let offset = 0; offset < arrayBuffer.byteLength; offset += 44) {
        const txid = Array.from(new Uint8Array(arrayBuffer, offset, 32)).reverse().map(b => b.toString(16).padStart(2, '0')).join('');
        const weight = view.getUint32(offset + 32);
        const fee = Number(view.getBigUint64(offset + 36));
        txs.push({
          txid,
          weight,
          fee
        });
      }
      return txs;
    } catch (e) {
      logger.warn(`Failed to unpack CPFP cluster. Reason: ` + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  /**
   * Pack cluster mempool data into binary format:
   * [num_chunks: uint16]
   * Per chunk: [num_txs: uint16]
   * Per tx (in linearization order, grouped by chunk):
   *   [txid: 32 bytes LE] [weight: uint32] [fee: uint64] [num_parents: uint8] [parent_indices: uint8 each]
   */
  public packCM(clusterData: CpfpClusterData): ArrayBuffer {
    const headerSize = 2;
    const chunkHeadersSize = clusterData.chunks.length * 2;
    let txDataSize = 0;
    for (const tx of clusterData.txs) {
      txDataSize += 32 + 4 + 8 + 1 + tx.parents.length;
    }
    const totalSize = headerSize + chunkHeadersSize + txDataSize;

    const buf = new ArrayBuffer(totalSize);
    const view = new DataView(buf);
    let offset = 0;

    view.setUint16(offset, clusterData.chunks.length);
    offset += 2;

    for (const chunk of clusterData.chunks) {
      view.setUint16(offset, chunk.txs.length);
      offset += 2;
    }

    for (const tx of clusterData.txs) {
      for (let x = 0; x < 32; x++) {
        view.setUint8(offset + (31 - x), parseInt(tx.txid.slice(x * 2, (x * 2) + 2), 16));
      }
      offset += 32;
      view.setUint32(offset, tx.weight);
      offset += 4;
      view.setBigUint64(offset, BigInt(Math.round(tx.fee)));
      offset += 8;
      view.setUint8(offset, tx.parents.length);
      offset += 1;
      for (const parentIdx of tx.parents) {
        view.setUint8(offset, parentIdx);
        offset += 1;
      }
    }

    return buf;
  }

  public unpackCM(buf: Buffer): CpfpClusterData {
    if (!buf) {
      return { txs: [], chunks: [] };
    }

    try {
      const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      const view = new DataView(arrayBuffer);
      let offset = 0;

      const numChunks = view.getUint16(offset);
      offset += 2;

      const chunkSizes: number[] = [];
      for (let i = 0; i < numChunks; i++) {
        chunkSizes.push(view.getUint16(offset));
        offset += 2;
      }

      const txs: CpfpClusterTx[] = [];
      const chunks: { txs: number[], feerate: number }[] = [];
      let txIndex = 0;

      for (let chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
        const chunkTxIndices: number[] = [];
        let chunkFee = 0;
        let chunkWeight = 0;

        for (let t = 0; t < chunkSizes[chunkIdx]; t++) {
          const txid = Array.from(new Uint8Array(arrayBuffer, offset, 32)).reverse().map(b => b.toString(16).padStart(2, '0')).join('');
          offset += 32;
          const weight = view.getUint32(offset);
          offset += 4;
          const fee = Number(view.getBigUint64(offset));
          offset += 8;
          const numParents = view.getUint8(offset);
          offset += 1;
          const parents: number[] = [];
          for (let p = 0; p < numParents; p++) {
            parents.push(view.getUint8(offset));
            offset += 1;
          }

          txs.push({ txid, fee, weight, parents });
          chunkTxIndices.push(txIndex);
          chunkFee += fee;
          chunkWeight += weight;
          txIndex++;
        }

        chunks.push({
          txs: chunkTxIndices,
          feerate: chunkWeight > 0 ? (chunkFee * 4) / chunkWeight : 0,
        });
      }

      return { txs, chunks };
    } catch (e) {
      logger.warn(`Failed to unpack CM CPFP cluster. Reason: ` + (e instanceof Error ? e.message : e));
      return { txs: [], chunks: [] };
    }
  }

  // returns `true` if two sets of CPFP clusters are deeply identical
  public compareClusters(clustersA: CpfpCluster[], clustersB: CpfpCluster[]): boolean {
    if (clustersA.length !== clustersB.length) {
      return false;
    }

    clustersA = clustersA.sort((a,b) => a.root.localeCompare(b.root));
    clustersB = clustersB.sort((a,b) => a.root.localeCompare(b.root));

    for (let i = 0; i < clustersA.length; i++) {
      if (clustersA[i].root !== clustersB[i].root) {
        return false;
      }
      if (clustersA[i].txs.length !== clustersB[i].txs.length) {
        return false;
      }
      for (let j = 0; j < clustersA[i].txs.length; j++) {
        if (clustersA[i].txs[j].txid !== clustersB[i].txs[j].txid) {
          return false;
        }
      }
    }

    return true;
  }
}

export default new CpfpRepository();