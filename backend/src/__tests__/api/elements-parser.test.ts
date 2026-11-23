import elementsParser from '../../api/liquid/elements-parser';
import DB from '../../database';

jest.mock('../../api/backend-info', () => ({ __esModule: true, default: { getBackendInfo: () => ({ hostname: 'self' }) } }));
const tweakFedPegScript = jest.fn();
jest.mock('../../api/bitcoin/bitcoin-client', () => ({ __esModule: true, default: {
  tweakFedPegScript: (...args: string[]) => tweakFedPegScript(...args),
  getBlockCount: async () => 101,
  getBlockHash: async () => 'liquid-blockhash',
  getBlock: async () => ({ height: 101, time: 1790000600, tx: [{ txid: 'liquid-tx', vout: [], vin: [{ txid: 'bitcoin-tx', vout: 0, is_pegin: true, pegin_witness: ['', '', '', 'claim-script'] }] }] }),
} }));
jest.mock('../../api/bitcoin/bitcoin-second-client', () => ({ __esModule: true, default: {
  getRawTransaction: async () => ({ txid: 'bitcoin-tx', blockhash: 'bitcoin-blockhash', vout: [{ n: 0, value: 1, scriptPubKey: { address: 'peg-in-address' } }] }),
  getBlock: async () => ({ height: 940000, time: 1790000000 }),
} }));

// The federation's fedpegscript since Liquid block 3991680, with a timelock of 8064 blocks
const fedpegscript = '5b21020e0338c96a8870479f2396c373cc7696ba124e8635d41b0ea581112b678172612103101440dac1411f7561dbcabedf1827b6517b4a78127c78fa5bc0f28d7f80c35821021fad939f956beae2e6765b450552f1a75236c8b7314ec30474d8f4978b252ab22103db6f3d90f9820cb7aa1c58f0ed84cca7a84bfe166e68061af1063834342c4c9d2102a4e1a9638d46923272c266631d94d36bdb03a64ee0e14c7518e49d2f29bc401021031c41fdbcebe17bec8d49816e00ca1b5ac34766b91c9f2ac37d39c63e5e008afb2102e323a079079582cf6bb68583df94bd68c9590e5904062b503ef5476109ad739e2103111cf405b627e22135b3b3733a4a34aa5723fb0f58379a16d32861bf576b0ec2210318f331b3e5d38156da6633b31929c5b220349859cc9ca3d33fb4e68aa08401742103230dae6b4ac93480aeab26d000841298e3b8f6157028e47b0897c1e025165de121035abff4281ff00660f99ab27bb53e6b33689c2cd8dcd364bc3c90ca5aea0d71a62103bd45cddfacf2083b14310ae4a84e25de61e451637346325222747b157446614c2103cc297026b06c71cbfa52089149157b5ff23de027ac5ab781800a578192d175462103d3bde5d63bdb3a6379b461be64dad45eabff42f758543a9645afd42f6d4248282103ed1e8d5109c9ed66f7941bc53cc71137baa76d50d274bda8d5e8ffbd6e61fe9a5fae736402801fb269522103aab896d53a8e7d6433137bbba940f9c521e085dd07e60994579b64a6d992cf79210291b7d0b1b692f8f524516ed950872e5da10fb1b808b5a526dedc6fed1cf29807210386aa9372fbab374593466bc5451dc59954e90787f08060964d95c87ef34ca5bb53ae68';
const parser = elementsParser as unknown as { federationPegScripts: object[], extractTimelockFromFedpegscript(script: string): number | null };

describe('Liquid peg-in timelock', () => {
  let lastElementsBlock: number;
  let savedTimelock: number | undefined;
  beforeEach(() => {
    lastElementsBlock = 100;
    savedTimelock = undefined;
    tweakFedPegScript.mockReset();
    parser.federationPegScripts = [{ fedpegscript, address: 'federation-address', timelock: 8064, blocknumber: 3991680 }];
    jest.spyOn(elementsParser, '$updateFederationUtxos').mockResolvedValue(undefined);
    jest.spyOn(DB, 'query').mockImplementation((async (sql: string, params: number[] = []) => {
      if (sql.includes('INTO federation_txos')) {
        savedTimelock = params[9];
      } else if (sql.startsWith('UPDATE state') && sql.includes('last_elements_block')) {
        lastElementsBlock = params[0];
      }
      return [[{ number: lastElementsBlock, lastblockupdate: 0 }], []];
    }) as never);
  });
  afterEach(() => jest.restoreAllMocks());

  test('reads the timelock of a federation script', () => {
    expect(parser.extractTimelockFromFedpegscript(fedpegscript)).toBe(8064);
  });

  test('parses the block again when Elements did not answer', async () => {
    tweakFedPegScript.mockRejectedValueOnce(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));
    await expect(elementsParser.$parse()).rejects.toThrow();
    expect([lastElementsBlock, savedTimelock]).toEqual([100, undefined]);
    tweakFedPegScript.mockResolvedValue({ p2wsh: 'peg-in-address' });
    await elementsParser.$parse();
    expect([lastElementsBlock, savedTimelock]).toEqual([101, 8064]);
  });

  test('saves the fallback timelock when Elements refuses the call', async () => {
    tweakFedPegScript.mockRejectedValue(Object.assign(new Error('Method not found'), { code: -32601 }));
    await elementsParser.$parse();
    expect([lastElementsBlock, savedTimelock]).toEqual([101, 0xffff]);
  });
});
