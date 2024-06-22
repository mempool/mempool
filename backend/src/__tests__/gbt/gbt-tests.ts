import fs from 'fs';
import { GbtGenerator, ThreadTransaction } from 'rust-gbt';
import path from 'path';

const baseline = require('./test-data/target-template.json');
const testVector = require('./test-data/test-data-ids.json');
const vectorUidMap: Map<number, string> = new Map(testVector.map(x => [x[0], x[1]]));
const vectorTxidMap: Map<string, number>  = new Map(testVector.map(x => [x[1], x[0]]));
// Note that this test buffer is specially constructed
// such that uids are assigned in numerical txid order
// so that ties break the same way as in Core's implementation
const vectorBuffer: Buffer = fs.readFileSync(path.join(__dirname, './', './test-data/test-buffer.bin'));

describe('Rust GBT', () => {
  test('should produce the same template as getBlockTemplate from Bitcoin Core', async () => {
    const rustGbt = new GbtGenerator(4_000_000, 8);
    const { mempool, maxUid } = mempoolFromArrayBuffer(vectorBuffer.buffer);
    const result = await rustGbt.make(mempool, [], maxUid);

    const blocks: [string, number][][] = result.blocks.map(block => {
      return block.map(uid => [vectorUidMap.get(uid) || 'missing', uid]);
    });
    const template = baseline.map(tx => [tx.txid, vectorTxidMap.get(tx.txid)]);

    expect(blocks[0].length).toEqual(baseline.length);
    expect(blocks[0]).toEqual(template);
  });
});

function mempoolFromArrayBuffer(buf: ArrayBuffer): { mempool: ThreadTransaction[], maxUid: number } {
  let maxUid = 0;
  const view = new DataView(buf);
  const count = view.getUint32(0, false);
  const txs: ThreadTransaction[] = [];
  let offset = 4;
  for (let i = 0; i < count; i++) {
    const uid = view.getUint32(offset, false);
    maxUid = Math.max(maxUid, uid);
    const tx: ThreadTransaction = {
      uid,
      order: txidToOrdering(vectorUidMap.get(uid) as string),
      fee: view.getFloat64(offset + 4, false),
      weight: view.getUint32(offset + 12, false),
      sigops: view.getUint32(offset + 16, false),
      // feePerVsize: view.getFloat64(offset + 20, false),
      effectiveFeePerVsize: view.getFloat64(offset + 28, false),
      inputs: [],
    };
    const numInputs = view.getUint32(offset + 36, false);
    offset += 40;
    for (let j = 0; j < numInputs; j++) {
      tx.inputs.push(view.getUint32(offset, false));
      offset += 4;
    }
    txs.push(tx);
  }
  return { mempool: txs, maxUid };
}

function txidToOrdering(txid: string): number {
  return parseInt(
    txid.substr(62, 2) +
      txid.substr(60, 2) +
      txid.substr(58, 2) +
      txid.substr(56, 2),
    16
  );
}
