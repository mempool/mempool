jest.mock('../../api/rbf-cache', () => ({
  __esModule: true,
  default: {
    has: jest.fn(() => false),
    isFullRbf: jest.fn(() => false),
    anyInSameTree: jest.fn(() => false),
    getReplacedBy: jest.fn(() => undefined),
  },
}));
jest.mock('../../api/transaction-utils', () => ({
  __esModule: true,
  default: {
    identifyPrioritizedTransactions: jest.fn(() => ({ prioritized: [], deprioritized: [] })),
  },
}));

import Audit from '../../api/audit';
import { Acceleration } from '../../api/services/acceleration';
import { MempoolBlockWithTransactions, MempoolTransactionExtended } from '../../mempool.interfaces';

const MINING_POOL = 141;
const OTHER_POOL = 73;
const UNRELATED_POOL = 999;

function makeTx(txid: string, extra: Partial<MempoolTransactionExtended> = {}): MempoolTransactionExtended {
  return {
    txid,
    weight: 800,
    vsize: 200,
    fee: 2000,
    effectiveFeePerVsize: 10,
    firstSeen: 1, // old enough to never be considered "fresh"
    ancestors: [],
    ...extra,
  } as MempoolTransactionExtended;
}

function makeAcceleration(txid: string, pools: number[]): Acceleration {
  return { txid, added: 0, effectiveVsize: 200, effectiveFee: 2000, feeDelta: 10000, pools };
}

describe('Audit acceleration attribution', () => {
  let mempool: { [txid: string]: MempoolTransactionExtended };
  let accelerations: Record<string, Acceleration>;
  let blockTxs: MempoolTransactionExtended[];
  let projectedBlocks: MempoolBlockWithTransactions[];

  beforeEach(() => {
    const parent = makeTx('parent');
    // the live mempool `acceleration` flag is set for any accepted acceleration, regardless of pool
    const child = makeTx('child', { acceleration: true, ancestors: [{ txid: 'parent', fee: 2000, weight: 800 }] });
    const otherPoolOnly = makeTx('otherPoolOnly', { acceleration: true });
    const plain = makeTx('plain');
    parent.acceleration = true;

    mempool = { parent, child, otherPoolOnly, plain };
    accelerations = {
      child: makeAcceleration('child', [MINING_POOL, OTHER_POOL]),
      otherPoolOnly: makeAcceleration('otherPoolOnly', [OTHER_POOL]),
      notInMempool: makeAcceleration('notInMempool', [MINING_POOL]),
    };
    blockTxs = [makeTx('coinbase'), parent, child, otherPoolOnly, plain];
    projectedBlocks = [{
      transactionIds: ['parent', 'child', 'otherPoolOnly', 'plain'],
      transactions: [],
    } as unknown as MempoolBlockWithTransactions];
  });

  describe('getPoolAcceleratedTxids', () => {
    test('includes accelerations accepted by the pool, and their ancestors', () => {
      const txids = Audit.getPoolAcceleratedTxids(mempool, accelerations, MINING_POOL);
      expect([...txids].sort()).toEqual(['child', 'parent']);
    });

    test('excludes accelerations the pool did not accept', () => {
      const txids = Audit.getPoolAcceleratedTxids(mempool, accelerations, OTHER_POOL);
      expect([...txids].sort()).toEqual(['child', 'otherPoolOnly', 'parent']);
    });

    test('is empty for a pool that accepted no acceleration', () => {
      const txids = Audit.getPoolAcceleratedTxids(mempool, accelerations, UNRELATED_POOL);
      expect(txids.size).toBe(0);
    });

    test('ignores accelerations for transactions missing from the mempool', () => {
      const txids = Audit.getPoolAcceleratedTxids(mempool, accelerations, MINING_POOL);
      expect(txids.has('notInMempool')).toBe(false);
    });

    test('ignores ancestors missing from the mempool', () => {
      delete mempool.parent;
      const txids = Audit.getPoolAcceleratedTxids(mempool, accelerations, MINING_POOL);
      expect([...txids]).toEqual(['child']);
    });
  });

  describe('auditBlock', () => {
    test('only marks transactions accelerated by the mining pool', () => {
      const poolAccelerated = Audit.getPoolAcceleratedTxids(mempool, accelerations, MINING_POOL);
      const result = Audit.auditBlock(blockTxs, projectedBlocks, mempool, poolAccelerated);
      expect(result.accelerated).toEqual(['parent', 'child']);
    });

    // regression: a non-participating pool mining an accelerated tx was audited as accelerated
    test('does not mark anything for a non-participating pool despite the mempool acceleration flag', () => {
      const poolAccelerated = Audit.getPoolAcceleratedTxids(mempool, accelerations, UNRELATED_POOL);
      const result = Audit.auditBlock(blockTxs, projectedBlocks, mempool, poolAccelerated);
      expect(result.accelerated).toEqual([]);
    });

    test('does not mark accelerated transactions that are not in the mempool', () => {
      const poolAccelerated = new Set(['notInMempool']);
      const result = Audit.auditBlock([...blockTxs, makeTx('notInMempool')], projectedBlocks, mempool, poolAccelerated);
      expect(result.accelerated).toEqual([]);
    });
  });
});
