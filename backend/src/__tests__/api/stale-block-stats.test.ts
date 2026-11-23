import blocks from '../../api/blocks';
import { IEsploraApi } from '../../api/bitcoin/esplora-api.interface';
import { TransactionExtended } from '../../mempool.interfaces';

const tx = (size: number, weight: number, fee: number, witnesses: string[][], values: number[]): TransactionExtended => {
  return {
    size, weight, fee, vsize: weight / 4,
    vin: witnesses.map(witness => ({ witness })),
    vout: values.map(value => ({ value })),
  } as TransactionExtended;
};

describe('Stale block stats', () => {
  test('leave out the coinbase and count segwit transactions, like getblockstats', async () => {
    const block = { id: 'stale', height: 900000, timestamp: 1700000600, size: 846, weight: 2744, stale: true } as IEsploraApi.Block;
    const coinbase = tx(200, 692, 0, [['00']], [312504000]);
    const legacy = tx(225, 900, 1000, [[]], [60000, 39000]);
    const segwit = tx(340, 832, 3000, [['aa', 'bb'], ['aa', 'bb']], [117000]);

    const stats = await blocks.$getBlockStats(block, [coinbase, legacy, segwit]);

    expect(stats).toMatchObject({
      avgfee: 2000,           // 4000 / 2 transactions
      avgfeerate: 9,          // 4000 * 4 / 1732 weight units, rounded down
      ins: 3,
      total_out: 216000,
      total_size: 565,
      total_weight: 1732,
      swtxs: 1,
      swtotal_size: 340,
      swtotal_weight: 832,
      utxo_increase: 1,       // 4 outputs - 3 inputs
    });
  });
});
