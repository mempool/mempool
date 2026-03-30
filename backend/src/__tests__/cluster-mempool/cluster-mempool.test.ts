import { ClusterMempool } from '../../cluster-mempool/cluster-mempool';
import { makeTx, txid } from './test-utils';
import { MempoolTransactionExtended } from '../../mempool.interfaces';

function buildMempool(txs: MempoolTransactionExtended[]): { [txid: string]: MempoolTransactionExtended } {
  const mempool: { [txid: string]: MempoolTransactionExtended } = {};
  for (const tx of txs) {
    mempool[tx.txid] = tx;
  }
  return mempool;
}

describe('ClusterMempool', () => {
  describe('constructor', () => {
    it('should build clusters from mempool', () => {
      const parentId = txid('a1');
      const childId = txid('a2');
      const mempool = buildMempool([
        makeTx(parentId, 100, 100),
        makeTx(childId, 5000, 100, [parentId]),
      ]);
      const cm = new ClusterMempool(mempool);
      expect(cm.getClusterCount()).toBe(1);
      expect(cm.getTxCount()).toBe(2);
    });

    it('should create separate clusters for unrelated txs', () => {
      const mempool = buildMempool([
        makeTx(txid('a1'), 100, 100),
        makeTx(txid('b1'), 200, 100),
      ]);
      const cm = new ClusterMempool(mempool);
      expect(cm.getClusterCount()).toBe(2);
    });
  });

  describe('getClusterInfo', () => {
    it('should return cluster info for a known tx', () => {
      const parentId = txid('a1');
      const childId = txid('a2');
      const mempool = buildMempool([
        makeTx(parentId, 100, 100),
        makeTx(childId, 5000, 100, [parentId]),
      ]);
      const cm = new ClusterMempool(mempool);
      const info = cm.getClusterInfo(parentId);
      expect(info).not.toBeNull();
      expect(info?.chunkFeerate).toBeGreaterThan(0);
    });

    it('should return null for unknown tx', () => {
      const mempool = buildMempool([makeTx(txid('a1'), 100, 100)]);
      const cm = new ClusterMempool(mempool);
      expect(cm.getClusterInfo(txid('zz'))).toBeNull();
    });
  });

  describe('getCluster', () => {
    it('should return cluster data with correct topology', () => {
      const parentId = txid('a1');
      const childId = txid('a2');
      const mempool = buildMempool([
        makeTx(parentId, 100, 100),
        makeTx(childId, 5000, 100, [parentId]),
      ]);
      const cm = new ClusterMempool(mempool);
      const info = cm.getClusterInfo(parentId);
      expect(info).not.toBeNull();
      const data = cm.getCluster(info!.clusterId);
      expect(data).not.toBeNull();
      expect(data!.txs.length).toBe(2);
      expect(data!.chunks.length).toBeGreaterThan(0);
    });

    it('should return null for unknown cluster id', () => {
      const mempool = buildMempool([makeTx(txid('a1'), 100, 100)]);
      const cm = new ClusterMempool(mempool);
      expect(cm.getCluster(9999)).toBeNull();
    });
  });

  describe('applyMempoolChange', () => {
    it('should handle adding a new singleton tx', () => {
      const mempool = buildMempool([makeTx(txid('a1'), 100, 100)]);
      const cm = new ClusterMempool(mempool);
      const initialCount = cm.getClusterCount();

      cm.applyMempoolChange({
        added: [makeTx(txid('b1'), 200, 100)],
        removed: [],
        accelerations: {},
      });

      expect(cm.getClusterCount()).toBe(initialCount + 1);
      expect(cm.getTxCount()).toBe(2);
    });

    it('should handle removing a tx', () => {
      const parentId = txid('a1');
      const childId = txid('a2');
      const mempool = buildMempool([
        makeTx(parentId, 100, 100),
        makeTx(childId, 5000, 100, [parentId]),
      ]);
      const cm = new ClusterMempool(mempool);

      cm.applyMempoolChange({
        added: [],
        removed: [childId],
        accelerations: {},
      });

      expect(cm.getTxCount()).toBe(1);
      expect(cm.getClusterInfo(childId)).toBeNull();
      expect(cm.getClusterInfo(parentId)).not.toBeNull();
    });

    it('should split cluster when middle tx is removed', () => {
      const a = txid('a1');
      const b = txid('b1');
      const c = txid('c1');
      const mempool = buildMempool([
        makeTx(a, 100, 100),
        makeTx(b, 200, 100, [a]),
        makeTx(c, 300, 100, [b]),
      ]);
      const cm = new ClusterMempool(mempool);
      expect(cm.getClusterCount()).toBe(1);

      cm.applyMempoolChange({
        added: [],
        removed: [b],
        accelerations: {},
      });

      expect(cm.getTxCount()).toBe(2);
      const infoA = cm.getClusterInfo(a);
      const infoC = cm.getClusterInfo(c);
      expect(infoA).not.toBeNull();
      expect(infoC).not.toBeNull();
      expect(infoA!.clusterId).not.toBe(infoC!.clusterId);
    });

    it('should handle fee changes via acceleration', () => {
      const parentId = txid('a1');
      const childId = txid('a2');
      const mempool = buildMempool([
        makeTx(parentId, 100, 100),
        makeTx(childId, 100, 100, [parentId]),
      ]);
      const cm = new ClusterMempool(mempool);
      const infoBefore = cm.getClusterInfo(childId);

      cm.applyMempoolChange({
        added: [],
        removed: [],
        accelerations: { [childId]: { feeDelta: 49900 } },
      });

      const infoAfter = cm.getClusterInfo(childId);
      expect(infoAfter).not.toBeNull();
      expect(infoAfter!.clusterId).not.toBe(infoBefore!.clusterId);
    });

    it('should merge clusters when new tx connects them', () => {
      const a = txid('a1');
      const b = txid('b1');
      const mempool = buildMempool([
        makeTx(a, 100, 100),
        makeTx(b, 200, 100),
      ]);
      const cm = new ClusterMempool(mempool);
      expect(cm.getClusterCount()).toBe(2);

      const bridgeTx = makeTx(txid('c1'), 300, 100, [a, b]);
      cm.applyMempoolChange({
        added: [bridgeTx],
        removed: [],
        accelerations: {},
      });

      expect(cm.getClusterCount()).toBe(1);
      expect(cm.getTxCount()).toBe(3);
    });
  });

  describe('cluster merging', () => {
    it('should merge 3 separate clusters when new tx bridges them', () => {
      const a = txid('a1');
      const b = txid('b1');
      const c = txid('c1');
      const mempool = buildMempool([
        makeTx(a, 100, 100),
        makeTx(b, 200, 100),
        makeTx(c, 300, 100),
      ]);
      const cm = new ClusterMempool(mempool);
      expect(cm.getClusterCount()).toBe(3);

      const bridge = makeTx(txid('d1'), 400, 100, [a, b, c]);
      mempool[bridge.txid] = bridge;
      cm.applyMempoolChange({ added: [bridge], removed: [], accelerations: {} });

      expect(cm.getClusterCount()).toBe(1);
      expect(cm.getTxCount()).toBe(4);
    });

    it('should grow cluster by 1 when new tx has parents in same cluster', () => {
      const a = txid('a1');
      const b = txid('b1');
      const mempool = buildMempool([
        makeTx(a, 100, 100),
        makeTx(b, 200, 100, [a]),
      ]);
      const cm = new ClusterMempool(mempool);
      expect(cm.getClusterCount()).toBe(1);

      const c = makeTx(txid('c1'), 300, 100, [a]);
      mempool[c.txid] = c;
      cm.applyMempoolChange({ added: [c], removed: [], accelerations: {} });

      expect(cm.getClusterCount()).toBe(1);
      expect(cm.getTxCount()).toBe(3);
    });

    it('should grow chain incrementally', () => {
      const a = txid('a1');
      const mempool = buildMempool([makeTx(a, 100, 100)]);
      const cm = new ClusterMempool(mempool);

      const b = makeTx(txid('b1'), 200, 100, [a]);
      mempool[b.txid] = b;
      cm.applyMempoolChange({ added: [b], removed: [], accelerations: {} });

      const c = makeTx(txid('c1'), 300, 100, [txid('b1')]);
      mempool[c.txid] = c;
      cm.applyMempoolChange({ added: [c], removed: [], accelerations: {} });

      expect(cm.getClusterCount()).toBe(1);
      expect(cm.getTxCount()).toBe(3);
    });
  });

  describe('cluster splitting', () => {
    it('should split star into singletons when center is removed', () => {
      const center = txid('center');
      const leaves = Array.from({ length: 5 }, (_, i) => txid(`leaf${i}`));
      const centerTx = makeTx(center, 100, 100);
      for (let i = 1; i < 5; i++) {
        centerTx.vout.push({
          scriptpubkey: '', scriptpubkey_asm: '', scriptpubkey_type: 'v0_p2wpkh', value: 50000,
        });
      }
      const leafTxs = leaves.map((l, i) => {
        const tx = makeTx(l, 200, 100, [center]);
        tx.vin[0].vout = i;
        return tx;
      });
      const mempool = buildMempool([centerTx, ...leafTxs]);
      const cm = new ClusterMempool(mempool);
      expect(cm.getClusterCount()).toBe(1);

      cm.applyMempoolChange({ added: [], removed: [center], accelerations: {} });

      expect(cm.getTxCount()).toBe(5);
      expect(cm.getClusterCount()).toBe(5);
    });

    it('should shrink cluster without splitting when leaf is removed', () => {
      const a = txid('a1');
      const b = txid('b1');
      const c = txid('c1');
      const aTx = makeTx(a, 100, 100);
      aTx.vout.push({ scriptpubkey: '', scriptpubkey_asm: '', scriptpubkey_type: 'v0_p2wpkh', value: 50000 });
      const bTx = makeTx(b, 200, 100, [a]);
      bTx.vin[0].vout = 0;
      const cTx = makeTx(c, 300, 100, [a]);
      cTx.vin[0].vout = 1;
      const mempool = buildMempool([aTx, bTx, cTx]);
      const cm = new ClusterMempool(mempool);
      expect(cm.getClusterCount()).toBe(1);

      cm.applyMempoolChange({ added: [], removed: [c], accelerations: {} });

      expect(cm.getClusterCount()).toBe(1);
      expect(cm.getTxCount()).toBe(2);
    });

    it('should produce singleton when tx is removed from 2-tx cluster', () => {
      const a = txid('a1');
      const b = txid('b1');
      const mempool = buildMempool([
        makeTx(a, 100, 100),
        makeTx(b, 200, 100, [a]),
      ]);
      const cm = new ClusterMempool(mempool);

      cm.applyMempoolChange({ added: [], removed: [b], accelerations: {} });

      expect(cm.getClusterCount()).toBe(1);
      expect(cm.getTxCount()).toBe(1);
      expect(cm.getClusterInfo(a)).not.toBeNull();
    });

    it('should create 3+ components when removing a tx that bridges multiple subgraphs', () => {
      const hub = txid('hub');
      const a = txid('a1');
      const b = txid('b1');
      const c = txid('c1');
      const hubTx = makeTx(hub, 100, 100);
      hubTx.vout.push(
        { scriptpubkey: '', scriptpubkey_asm: '', scriptpubkey_type: 'v0_p2wpkh', value: 50000 },
        { scriptpubkey: '', scriptpubkey_asm: '', scriptpubkey_type: 'v0_p2wpkh', value: 50000 },
      );
      const txA = makeTx(a, 200, 100, [hub]);
      txA.vin[0].vout = 0;
      const txB = makeTx(b, 300, 100, [hub]);
      txB.vin[0].vout = 1;
      const txC = makeTx(c, 400, 100, [hub]);
      txC.vin[0].vout = 2;
      const mempool = buildMempool([hubTx, txA, txB, txC]);
      const cm = new ClusterMempool(mempool);
      expect(cm.getClusterCount()).toBe(1);

      cm.applyMempoolChange({ added: [], removed: [hub], accelerations: {} });

      expect(cm.getClusterCount()).toBe(3);
      expect(cm.getTxCount()).toBe(3);
    });
  });

  describe('fee changes via accelerations', () => {
    it('should increase chunk feerate when acceleration added', () => {
      const a = txid('a1');
      const mempool = buildMempool([makeTx(a, 100, 100)]);
      const cm = new ClusterMempool(mempool);
      const infoBefore = cm.getClusterInfo(a);
      expect(infoBefore).not.toBeNull();

      cm.applyMempoolChange({
        added: [],
        removed: [],
        accelerations: { [a]: { feeDelta: 9900 } },
      });

      const infoAfter = cm.getClusterInfo(a);
      expect(infoAfter).not.toBeNull();
      expect(infoAfter!.chunkFeerate).toBeGreaterThan(infoBefore!.chunkFeerate);
    });

    it('should decrease chunk feerate when acceleration removed', () => {
      const a = txid('a1');
      const mempool = buildMempool([makeTx(a, 100, 100)]);
      const cm = new ClusterMempool(mempool, { [a]: { feeDelta: 9900 } });
      const infoBefore = cm.getClusterInfo(a);
      expect(infoBefore).not.toBeNull();

      cm.applyMempoolChange({
        added: [],
        removed: [],
        accelerations: {},
      });

      const infoAfter = cm.getClusterInfo(a);
      expect(infoAfter).not.toBeNull();
      expect(infoAfter!.chunkFeerate).toBeLessThan(infoBefore!.chunkFeerate);
    });

    it('should reorder chunks when acceleration shifts priorities', () => {
      const a = txid('a1');
      const b = txid('b1');
      const mempool = buildMempool([
        makeTx(a, 100, 100),
        makeTx(b, 200, 100, [a]),
      ]);
      const cm = new ClusterMempool(mempool);
      const infoBBefore = cm.getClusterInfo(b);
      expect(infoBBefore).not.toBeNull();

      cm.applyMempoolChange({
        added: [],
        removed: [],
        accelerations: { [b]: { feeDelta: 49800 } },
      });

      const infoBAfter = cm.getClusterInfo(b);
      expect(infoBAfter).not.toBeNull();
      expect(infoBAfter!.chunkFeerate).toBeGreaterThan(infoBBefore!.chunkFeerate);
    });
  });

  describe('getBlocks', () => {
    it('should return projected blocks', () => {
      const txs: MempoolTransactionExtended[] = [];
      for (let i = 0; i < 10; i++) {
        txs.push(makeTx(txid(`t${i}`), 1000 * (i + 1), 100));
      }
      const mempool = buildMempool(txs);
      const cm = new ClusterMempool(mempool);
      const blocks = cm.getBlocks(3);
      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks[0].txids.length).toBeGreaterThan(0);
    });

    it('should return empty array for empty mempool', () => {
      const cm = new ClusterMempool({});
      const blocks = cm.getBlocks(3);
      expect(blocks.length).toBe(0);
    });

    it('should respect chunk ordering for single-cluster mempool', () => {
      const a = txid('a1');
      const b = txid('b1');
      const c = txid('c1');
      const mempool = buildMempool([
        makeTx(a, 3000, 100),
        makeTx(b, 200, 100, [a]),
        makeTx(c, 100, 100, [b]),
      ]);
      const cm = new ClusterMempool(mempool);
      const blocks = cm.getBlocks(1);
      expect(blocks.length).toBe(1);
      const txids = blocks[0].txids;
      expect(txids.indexOf(a)).toBeLessThan(txids.indexOf(b));
      expect(txids.indexOf(b)).toBeLessThan(txids.indexOf(c));
    });

    it('should maintain topological validity within blocks', () => {
      const a = txid('a1');
      const b = txid('b1');
      const c = txid('c1');
      const d = txid('d1');
      const aTx = makeTx(a, 1000, 100);
      aTx.vout.push({ scriptpubkey: '', scriptpubkey_asm: '', scriptpubkey_type: 'v0_p2wpkh', value: 50000 });
      const bTx = makeTx(b, 500, 100, [a]);
      bTx.vin[0].vout = 0;
      const cTx = makeTx(c, 500, 100, [a]);
      cTx.vin[0].vout = 1;
      const mempool = buildMempool([aTx, bTx, cTx, makeTx(d, 200, 100, [b, c])]);
      const cm = new ClusterMempool(mempool);
      const blocks = cm.getBlocks(1);
      const txids = blocks[0].txids;

      expect(txids.indexOf(a)).toBeLessThan(txids.indexOf(b));
      expect(txids.indexOf(a)).toBeLessThan(txids.indexOf(c));
      expect(txids.indexOf(b)).toBeLessThan(txids.indexOf(d));
      expect(txids.indexOf(c)).toBeLessThan(txids.indexOf(d));
    });
  });

  describe('empty and degenerate cases', () => {
    it('should handle empty diff with no changes', () => {
      const mempool = buildMempool([makeTx(txid('a1'), 100, 100)]);
      const cm = new ClusterMempool(mempool);
      const countBefore = cm.getClusterCount();
      const txCountBefore = cm.getTxCount();

      cm.applyMempoolChange({ added: [], removed: [], accelerations: {} });

      expect(cm.getClusterCount()).toBe(countBefore);
      expect(cm.getTxCount()).toBe(txCountBefore);
    });

    it('should not crash when removing nonexistent tx', () => {
      const mempool = buildMempool([makeTx(txid('a1'), 100, 100)]);
      const cm = new ClusterMempool(mempool);

      cm.applyMempoolChange({
        added: [],
        removed: [txid('nonexistent')],
        accelerations: {},
      });

      expect(cm.getTxCount()).toBe(1);
    });
  });
});
