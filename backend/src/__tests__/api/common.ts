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
