import { Common } from '../../api/common';
import { MempoolTransactionExtended, TransactionExtended } from '../../mempool.interfaces';

const randomTransactions = require('./test-data/transactions-random.json');
const replacedTransactions = require('./test-data/transactions-replaced.json');
const rbfTransactions = require('./test-data/transactions-rbfs.json');
const nonStandardTransactions = require('./test-data/non-standard-txs.json');

describe('Common', () => {
  describe('RBF', () => {
    const newTransactions = rbfTransactions.concat(randomTransactions);
    test('should detect RBF transactions with fast method', () => {
      const result: { [txid: string]: { replaced: MempoolTransactionExtended[], replacedBy: TransactionExtended }} = Common.findRbfTransactions(newTransactions, replacedTransactions);
      expect(Object.values(result).length).toEqual(2);
      expect(result).toHaveProperty('7219d95161f3718335991ac6d967d24eedec370908c9879bb1e192e6d797d0a6');
      expect(result).toHaveProperty('5387881d695d4564d397026dc5f740f816f8390b4b2c5ec8c20309122712a875');
    });

    test('should detect RBF transactions with scalable method', () => {
      const result: { [txid: string]: { replaced: MempoolTransactionExtended[], replacedBy: TransactionExtended }} = Common.findRbfTransactions(newTransactions, replacedTransactions, true);
      expect(Object.values(result).length).toEqual(2);
      expect(result).toHaveProperty('7219d95161f3718335991ac6d967d24eedec370908c9879bb1e192e6d797d0a6');
      expect(result).toHaveProperty('5387881d695d4564d397026dc5f740f816f8390b4b2c5ec8c20309122712a875');
    });
  });

  describe('Mempool Goggles', () => {
    test('should detect nonstandard transactions', () => {
      nonStandardTransactions.forEach((tx) => {
        expect(Common.isNonStandard(tx)).toEqual(true);
      });
    });

    test('should not misclassify as nonstandard transactions', () => {
      randomTransactions.forEach((tx) => {
        expect(Common.isNonStandard(tx)).toEqual(false);
      });
    });

    describe('TRUC (BIP-431)', () => {
      const { TransactionFlags } = require('../../mempool.interfaces');
      const makeTx = (version: number, vsize: number, ancestors: any[] = [], descendants: any[] = []) => ({
        version,
        vsize,
        weight: vsize * 4,
        sigops: 0,
        ancestors,
        descendants,
        vin: [{
          sequence: 0xfffffffd,
          is_coinbase: false,
          scriptsig: '',
          scriptsig_asm: '',
          prevout: { scriptpubkey_type: 'v0_p2wpkh', scriptpubkey: '00140000000000000000000000000000000000000000', scriptpubkey_asm: '', value: 10000 },
          witness: [],
        }],
        vout: [{ scriptpubkey_type: 'v0_p2wpkh', scriptpubkey: '00140000000000000000000000000000000000000000', scriptpubkey_asm: '', value: 1000 }],
      } as unknown as TransactionExtended);

      test('flags a v3 parent and child in a CPFP package', () => {
        const parent = makeTx(3, 400, [], [{ txid: 'child' }]);
        const child = makeTx(3, 200, [{ txid: 'parent' }], []);
        const parentFlags = Common.getTransactionFlags(parent);
        const childFlags = Common.getTransactionFlags(child);
        expect(BigInt(parentFlags) & TransactionFlags.truc).toEqual(TransactionFlags.truc);
        expect(BigInt(childFlags) & TransactionFlags.truc).toEqual(TransactionFlags.truc);
      });

      test('does not flag a standalone v3 transaction', () => {
        const flags = Common.getTransactionFlags(makeTx(3, 200));
        expect(BigInt(flags) & TransactionFlags.truc).toEqual(0n);
        expect(BigInt(flags) & TransactionFlags.v3).toEqual(TransactionFlags.v3);
      });

      test('does not flag non-v3 package members', () => {
        const parent = makeTx(2, 400, [], [{ txid: 'child' }]);
        const child = makeTx(2, 200, [{ txid: 'parent' }], []);
        expect(BigInt(Common.getTransactionFlags(parent)) & TransactionFlags.truc).toEqual(0n);
        expect(BigInt(Common.getTransactionFlags(child)) & TransactionFlags.truc).toEqual(0n);
      });

      test('enforces the BIP-431 vsize limits inclusively', () => {
        // parent must be no larger than 10,000vB, child no larger than 1,000vB
        const parent = makeTx(3, 10000, [], [{ txid: 'child' }]);
        const tooBigParent = makeTx(3, 10001, [], [{ txid: 'child' }]);
        const child = makeTx(3, 1000, [{ txid: 'parent' }], []);
        const tooBigChild = makeTx(3, 1001, [{ txid: 'parent' }], []);
        expect(BigInt(Common.getTransactionFlags(parent)) & TransactionFlags.truc).toEqual(TransactionFlags.truc);
        expect(BigInt(Common.getTransactionFlags(tooBigParent)) & TransactionFlags.truc).toEqual(0n);
        expect(BigInt(Common.getTransactionFlags(child)) & TransactionFlags.truc).toEqual(TransactionFlags.truc);
        expect(BigInt(Common.getTransactionFlags(tooBigChild)) & TransactionFlags.truc).toEqual(0n);
      });

      test('does not flag mid-chain v3 transactions', () => {
        const midChain = makeTx(3, 200, [{ txid: 'parent' }], [{ txid: 'grandchild' }]);
        expect(BigInt(Common.getTransactionFlags(midChain)) & TransactionFlags.truc).toEqual(0n);
      });

      test('recalculates TRUC status as packages form and dissolve', () => {
        // tx already classified (has stored flags), as happens on mempool updates
        const tx = makeTx(3, 200, [{ txid: 'parent' }], []);
        tx.flags = Common.getTransactionFlags(tx);
        expect(BigInt(tx.flags as number) & TransactionFlags.truc).toEqual(TransactionFlags.truc);
        // the package dissolves: the flag must be cleared on reclassification
        tx.ancestors = [];
        tx.flags = Common.getTransactionFlags(tx);
        expect(BigInt(tx.flags as number) & TransactionFlags.truc).toEqual(0n);
        // ...and set again if a new package forms
        tx.ancestors = [{ txid: 'new-parent' }] as any;
        tx.flags = Common.getTransactionFlags(tx);
        expect(BigInt(tx.flags as number) & TransactionFlags.truc).toEqual(TransactionFlags.truc);
      });
    });

    describe('P2A anchors', () => {
      const { TransactionFlags } = require('../../mempool.interfaces');
      const makeAnchorTx = (direction: 'input' | 'output') => ({
        version: 3,
        vsize: 200,
        weight: 800,
        sigops: 0,
        vin: [{
          sequence: 0xfffffffd,
          is_coinbase: false,
          scriptsig: '',
          scriptsig_asm: '',
          prevout: {
            scriptpubkey_type: direction === 'input' ? 'anchor' : 'v0_p2wpkh',
            scriptpubkey: direction === 'input' ? '51024e73' : '00140000000000000000000000000000000000000000',
            scriptpubkey_asm: direction === 'input' ? 'OP_1 OP_PUSHBYTES_2 4e73' : '',
            value: 330,
          },
          witness: [],
        }],
        vout: [{
          scriptpubkey_type: direction === 'output' ? 'anchor' : 'v0_p2wpkh',
          scriptpubkey: direction === 'output' ? '51024e73' : '00140000000000000000000000000000000000000000',
          scriptpubkey_asm: direction === 'output' ? 'OP_1 OP_PUSHBYTES_2 4e73' : '',
          value: 330,
        }],
      } as unknown as TransactionExtended);

      test('flags transactions spending from or paying to anchor outputs', () => {
        expect(BigInt(Common.getTransactionFlags(makeAnchorTx('input'))) & TransactionFlags.p2a).toEqual(TransactionFlags.p2a);
        expect(BigInt(Common.getTransactionFlags(makeAnchorTx('output'))) & TransactionFlags.p2a).toEqual(TransactionFlags.p2a);
      });

      test('does not flag transactions without anchor outputs', () => {
        const tx = randomTransactions[0];
        expect(BigInt(Common.getTransactionFlags(tx)) & TransactionFlags.p2a).toEqual(0n);
      });
    });
  });

  describe('Effective Fee Statistics', () => {
    test('returns safe defaults for blocks with only coinbase', () => {
      const coinbaseTx = { weight: 1000, fee: 0, txid: 'coinbase0' };
      const result = Common.calcEffectiveFeeStatistics([coinbaseTx]);

      expect(result.medianFee).toBe(0);
      expect(result.feeRange).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });

    test('excludes coinbase from fee stats when multiple txs', () => {
      const coinbaseTx = { weight: 1000, fee: 0, txid: 'coinbase0' };
      const tx1 = { weight: 400, fee: 100, txid: 'tx1' }; // vsize 100, rate 1 sat/vB
      const tx2 = { weight: 400, fee: 250, txid: 'tx2' }; // vsize 100, rate 2.5 sat/vB

      const result = Common.calcEffectiveFeeStatistics([coinbaseTx, tx1, tx2]);

      // Verify that coinbase (fee 0) was excluded from stats
      // Fee range min/max should be > 0 (not affected by coinbase's 0 fee)
      expect(result.feeRange[0]).toBeGreaterThan(0); // min fee
      expect(result.feeRange[6]).toBeGreaterThan(0); // max fee
    });
  });
});
