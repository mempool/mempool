import cluster, { Cluster } from 'cluster';
import { RowDataPacket } from 'mysql2';
import DB from '../database';
import logger from '../logger';
import { Ancestor } from '../mempool.interfaces';
import transactionRepository from '../repositories/TransactionRepository';

class CpfpRepository {
  public async $saveCluster(clusterRoot: string, height: number, txs: Ancestor[], effectiveFeePerVsize: number): Promise<void> {
    if (!txs[0]) {
      return;
    }
    try {
      const packedTxs = Buffer.from(this.pack(txs));
      await DB.query(
        `
          INSERT INTO compact_cpfp_clusters(root, height, txs, fee_rate)
          VALUE (UNHEX(?), ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            height = ?,
            txs = ?,
            fee_rate = ?
        `,
        [clusterRoot, height, packedTxs, effectiveFeePerVsize, height, packedTxs, effectiveFeePerVsize]
      );
      for (const tx of txs) {
        await transactionRepository.$setCluster(tx.txid, clusterRoot);
      }
    } catch (e: any) {
      logger.err(`Cannot save cpfp cluster into db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getCluster(clusterRoot: string): Promise<Cluster> {
    const [clusterRows]: any = await DB.query(
      `
        SELECT *
        FROM compact_cpfp_clusters
        WHERE root = UNHEX(?)
      `,
      [clusterRoot]
    );
    const cluster = clusterRows[0];
    cluster.txs = this.unpack(cluster.txs);
    return cluster;
  }

  public async $deleteClustersFrom(height: number): Promise<void> {
    logger.info(`Delete newer cpfp clusters from height ${height} from the database`);
    try {
      const [rows] = await DB.query(
        `
          SELECT txs, height, root from compact_cpfp_clusters
          WHERE height >= ?
        `,
        [height]
      ) as RowDataPacket[][];
      if (rows?.length) {
        for (let clusterToDelete of rows) {
          const txs = this.unpack(clusterToDelete.txs);
          for (let tx of txs) {
            await transactionRepository.$removeTransaction(tx.txid);
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
  }
}

export default new CpfpRepository();