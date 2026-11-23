let mockPegs: any[] = [];
// Stand-in for elements_pegs: a link is written to every pending row that the statement's conditions select
const mockQuery = jest.fn(async (sql: string, params: (string | number)[] = []): Promise<any> => {
  const pending = sql.match(/^SELECT (.+) FROM elements_pegs where amount < 0/);
  if (pending) {
    return [mockPegs.filter(peg => peg.bitcointxid === '').map(peg => Object.fromEntries(pending[1].split(', ').map(column => [column, peg[column]])))];
  }
  const link = sql.match(/^UPDATE elements_pegs SET bitcointxid = \?, bitcoinindex = \? WHERE (.+) AND bitcointxid = ''$/);
  if (link) {
    const columns = link[1].split(' AND ').map(condition => condition.replace(' = ?', ''));
    for (const peg of mockPegs.filter(row => row.bitcointxid === '' && columns.every((column, i) => row[column] === params[i + 2]))) {
      peg.bitcointxid = params[0];
      peg.bitcoinindex = params[1];
    }
  }
  return [[]];
});
jest.mock('../../database', () => ({ __esModule: true, default: { query: (sql: string, params?: (string | number)[]) => mockQuery(sql, params) } }));
jest.mock('../../api/bitcoin/bitcoin-client', () => ({ __esModule: true, default: {} }));
jest.mock('../../api/bitcoin/bitcoin-second-client', () => ({ __esModule: true, default: {} }));
// Common pulls in most of the backend, including modules that start timers when they are imported
jest.mock('../../api/common', () => ({ Common: {} }));

import elementsParser from '../../api/liquid/elements-parser';

describe('Federation audit', () => {
  it('links a payout to only one of two peg-outs that share a Liquid block, address and amount', async () => {
    const parser = elementsParser as any;
    const address = 'bc1qpegoutaddress';
    const pegOut = { txid: 'a1'.repeat(32), datetime: 1750000000, amount: -50000000, bitcoinaddress: address, bitcointxid: '', bitcoinindex: 0 };
    mockPegs = [{ ...pegOut, txindex: 0 }, { ...pegOut, txindex: 1 }];
    const federationUtxo = { txid: 'fe'.repeat(32), txindex: 0, amount: 100000000, expiredAt: 0 };
    const block = { height: 900000, time: 1750003600, tx: [{
      txid: 'b1'.repeat(32),
      vin: [{ txid: federationUtxo.txid, vout: 0 }],
      vout: [{ value: 0.5, n: 0, scriptPubKey: { address } }],
    }] };
    const pendingByAddress = new Map([[address, await parser.$getRedeemAddressesToScan()]]);

    await parser.$parseBitcoinBlock(block, new Map([[`${federationUtxo.txid}:0`, federationUtxo]]), pendingByAddress);

    expect(mockPegs.filter(peg => peg.bitcointxid === block.tx[0].txid)).toHaveLength(1);
    expect(pendingByAddress.get(address)).toHaveLength(1);
  });
});
