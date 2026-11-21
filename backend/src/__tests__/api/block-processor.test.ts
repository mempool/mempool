const mockMempool: { [txid: string]: any } = {};
let mockProjected: any[] = [];

jest.mock('../../api/mempool', () => ({
  __esModule: true,
  default: {
    getMempool: jest.fn(() => mockMempool),
    getMempoolCandidates: jest.fn(() => undefined),
    isInSync: jest.fn(() => true),
    limitGBT: false,
  },
}));
jest.mock('../../api/mempool-blocks', () => ({
  __esModule: true,
  default: {
    $makeBlockTemplates: jest.fn(async () => mockProjected),
    getMempoolBlocksWithTransactions: jest.fn(() => []),
  },
}));
jest.mock('../../api/blocks', () => ({ __esModule: true, default: {} }));
jest.mock('../../api/services/acceleration', () => ({
  __esModule: true,
  default: { isAcceleratedBlock: jest.fn(() => false) },
}));
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

import config from '../../config';
import blockProcessor from '../../api/block-processor';
import { MempoolTransactionExtended, TemplateAlgorithm } from '../../mempool.interfaces';

function makeTx(txid: string): MempoolTransactionExtended {
  return { txid, weight: 800, vsize: 200, fee: 2000, effectiveFeePerVsize: 10, firstSeen: 1, ancestors: [] } as unknown as MempoolTransactionExtended;
}

describe('BlockProcessor audit', () => {
  const rustGbt = config.MEMPOOL.RUST_GBT;
  const pool = { uniqueId: 1 } as any;
  const block = { id: 'block', height: 100 } as any;
  const runAudit = (transactions: MempoolTransactionExtended[]): Promise<any> =>
    (blockProcessor as any).$runAudit(block, transactions, TemplateAlgorithm.legacy, pool, {});

  beforeAll(() => {
    config.MEMPOOL.RUST_GBT = false;
  });
  afterAll(() => {
    config.MEMPOOL.RUST_GBT = rustGbt;
  });
  beforeEach(() => {
    for (const txid of Object.keys(mockMempool)) {
      delete mockMempool[txid];
    }
    mockProjected = [];
  });

  // regression: an empty mempool has no projected block, and saving the audit template threw on every block
  test('does not audit a block when nothing was projected', async () => {
    await expect(runAudit([makeTx('coinbase')])).resolves.toBeUndefined();
  });

  test('audits a block against the projected block', async () => {
    const tx = makeTx('a');
    mockMempool.a = tx;
    mockProjected = [{ transactionIds: ['a'], transactions: [{ txid: 'a', fee: 2000, vsize: 200 }] }];
    const result = await runAudit([makeTx('coinbase'), tx]);
    expect(result.matchRate).toBe(100);
    expect(result.unseen).toEqual([]);
    expect(result.projectedBlocks[0].transactions.map(t => t.txid)).toEqual(['a']);
    expect(result.expectedFees).toBe(2000);
    expect(result.expectedWeight).toBe(800);
  });
});
