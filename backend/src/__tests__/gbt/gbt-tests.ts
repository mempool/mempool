import fs from 'fs';
import { GbtGenerator } from '../../../rust-gbt';
import path from 'path';

const baseline = require('./test-data/target-template.json');
const testVector = require('./test-data/test-data-ids.json');
const vectorUidMap: Map<number, string> = new Map(testVector.map(x => [x[0], x[1]]));
const vectorTxidMap: Map<string, number>  = new Map(testVector.map(x => [x[1], x[0]]));
// Note that this test buffer is specially constructed
// such that uids are assigned in numerical txid order
// so that ties break the same way as in Core's implementation
const vectorBuffer: ArrayBuffer = fs.readFileSync(path.join(__dirname, './', './test-data/test-buffer.bin'));

describe('Rust GBT', () => {
  test('should produce the same template as getBlockTemplate from Bitcoin Core', async () => {
    const rustGbt = new GbtGenerator();
    const result = await rustGbt.make(new Uint8Array(vectorBuffer));

    const blocks: [string, number][][] = result.blocks.map(block => {
      return block.map(uid => [vectorUidMap.get(uid) || 'missing', uid]);
    });
    const template = baseline.map(tx => [tx.txid, vectorTxidMap.get(tx.txid)]);

    expect(blocks[0].length).toEqual(baseline.length);
    expect(blocks[0]).toEqual(template);
  });
});
