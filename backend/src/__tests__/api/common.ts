import { Common } from '../../api/common';
import { MempoolTransactionExtended } from '../../mempool.interfaces';

const randomTransactions = require('./test-data/transactions-random.json');
const replacedTransactions = require('./test-data/transactions-replaced.json');
const rbfTransactions = require('./test-data/transactions-rbfs.json');

describe('Mempool Utils', () => {
  test('should detect RBF transactions with fast method', () => {
    const newTransactions = rbfTransactions.concat(randomTransactions);
    const result: { [txid: string]: MempoolTransactionExtended[] } = Common.findRbfTransactions(newTransactions, replacedTransactions);
    expect(Object.values(result).length).toEqual(2);
    expect(result).toHaveProperty('7219d95161f3718335991ac6d967d24eedec370908c9879bb1e192e6d797d0a6');
    expect(result).toHaveProperty('5387881d695d4564d397026dc5f740f816f8390b4b2c5ec8c20309122712a875');
  });

  test.only('should detect RBF transactions with scalable method', () => {
    const newTransactions = rbfTransactions.concat(randomTransactions);
    const result: { [txid: string]: MempoolTransactionExtended[] } = Common.findRbfTransactions(newTransactions, replacedTransactions, true);
    expect(Object.values(result).length).toEqual(2);
    expect(result).toHaveProperty('7219d95161f3718335991ac6d967d24eedec370908c9879bb1e192e6d797d0a6');
    expect(result).toHaveProperty('5387881d695d4564d397026dc5f740f816f8390b4b2c5ec8c20309122712a875');
  });
});
