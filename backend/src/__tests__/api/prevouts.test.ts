jest.mock('../../api/mempool', () => ({ __esModule: true, default: { getMempool: () => ({}) } }));
const getTxOut = jest.fn();
jest.mock('../../api/bitcoin/bitcoin-client', () => ({
  __esModule: true,
  default: { getTxOut: (...args: unknown[]) => getTxOut(...args) },
}));

// The routes module graph starts timers at import time; fake timers keep them from becoming open handles
jest.useFakeTimers();
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bitcoinRoutes = require('../../api/bitcoin/bitcoin.routes').default;

const outpoints = ['a', 'b', 'c', 'd'].map(char => ({ txid: char.repeat(64), vout: 0 }));
const rpcError = (code: string | number): Error => Object.assign(new Error('rpc error'), { code });

async function getPrevouts(count: number): Promise<{ status: number, body: unknown, headers: Record<string, string> }> {
  const response = { status: 200, body: undefined as unknown, headers: {} as Record<string, string> };
  const res = {
    status: (code: number): typeof res => { response.status = code; return res; },
    setHeader: (name: string, value: string): void => { response.headers[name] = value; },
    json: (body: unknown): void => { response.body = body; },
  };
  await bitcoinRoutes.$getPrevouts({ body: outpoints.slice(0, count), accepts: () => true }, res);
  return response;
}

describe('POST /api/v1/prevouts', () => {
  afterAll(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('failed lookups are listed by position; an outpoint Core rejects or does not have stays null', async () => {
    getTxOut
      .mockRejectedValueOnce(rpcError('ETIMEDOUT'))
      .mockRejectedValueOnce(rpcError(-1)) // "JSON integer out of range": Core answered, no such output
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(rpcError(-28)); // Core is still starting up

    const response = await getPrevouts(4);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([null, null, null, null]);
    expect(response.headers).toEqual({ 'X-Prevouts-Failed': '0,3' });
  });

  test('the request fails when every lookup failed', async () => {
    getTxOut.mockReset().mockRejectedValue(rpcError('ECONNREFUSED'));

    const response = await getPrevouts(2);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'Failed to get prevouts' });
  });
});
