import { Request, Response } from 'express';

const getChannelsByTransactionId = jest.fn();
jest.mock('../../api/explorer/channels.api', () => ({
  __esModule: true,
  default: { $getChannelsByTransactionId: (...args: [string[]]) => getChannelsByTransactionId(...args) },
}));

const getOutSpendsByOutpoint = jest.fn();
jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  default: { $getOutSpendsByOutpoint: (...args: [{ txid: string, vout: number }[]]) => getOutSpendsByOutpoint(...args) },
}));

import config from '../../config';
import channelsRoutes from '../../api/explorer/channels.routes';

describe('GET /api/v1/lightning/channels/txids', () => {
  const backend = config.MEMPOOL.BACKEND;

  beforeAll(() => {
    config.MEMPOOL.BACKEND = 'esplora';
  });

  afterAll(() => {
    config.MEMPOOL.BACKEND = backend;
  });

  it('attaches each closed channel to the input that spends its funding output', async () => {
    const closingTx = 'c'.repeat(64);
    const first = { id: '1', transaction_id: '1'.repeat(64), transaction_vout: 0, closing_transaction_id: closingTx };
    const second = { id: '2', transaction_id: '2'.repeat(64), transaction_vout: 1, closing_transaction_id: closingTx };
    getChannelsByTransactionId.mockResolvedValue([first, second]);
    getOutSpendsByOutpoint.mockResolvedValue([{ spent: true, txid: closingTx, vin: 1 }, { spent: true, txid: closingTx, vin: 3 }]);
    const req = { query: { txId: [closingTx] }, accepts: () => 'json' } as unknown as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };

    await channelsRoutes['$getChannelsByTransactionIds'](req, res as unknown as Response);

    expect(getOutSpendsByOutpoint).toHaveBeenCalledWith([{ txid: first.transaction_id, vout: 0 }, { txid: second.transaction_id, vout: 1 }]);
    expect(res.json).toHaveBeenCalledWith([{ inputs: { 1: first, 3: second }, outputs: {} }]);
  });
});
