/**
 * Note: this file is only a temp solution to show that the sorting algorithm is correct.
 * It should be migrated to a unit test.
 * 
 * This file should be run with ts-node
 * $ npm install -g ts-node
 * $ cd ./frontend
 * $ ts-node runme.ts
 * 
 * If it doesn't show anything, then all is fine.
 * If it shows assert equals error, there's a problem.
 */

import * as assert from 'assert';
import { Transaction } from './src/app/interfaces/electrs.interface';
import { sortTransactions } from './src/app/shared/common.utils';

function makeVector(txid: string, parentTxid: string, confirmed: boolean, bhOrFs: number): Transaction {
  return {
    status: {
      confirmed,
      block_height: confirmed ? bhOrFs : undefined,
    },
    firstSeen: confirmed ? undefined : bhOrFs,
    txid,
    vin: [
      {
        txid: parentTxid,
      },
    ],
  } as never as Transaction // force it, this is all we need to sort
}

// txids only matter when same block, so xxx all others
const unsorted = [
  makeVector("xxx", "xxx", true, 1005),
  makeVector("xxx", "xxx", true, 1002),
  makeVector("xxx", "xxx", false, 1235),

  makeVector("txid_1", "txid_3", true, 1004),
  makeVector("txid_2", "firstdeposit1", true, 1004),
  makeVector("txid_3", "txid_2", true, 1004),
  makeVector("txid_4", "txid_1", true, 1004),

  makeVector("xxx", "xxx", false, 1234),

  makeVector("txida_1", "txida_4", true, 1001),
  makeVector("txida_2", "txida_1", true, 1001),
  makeVector("txida_3", "firstdeposit2", true, 1001),
  makeVector("txida_4", "txida_3", true, 1001),

  makeVector("xxx", "xxx", false, 1236),
  makeVector("xxx", "xxx", true, 1003),
];

const sorted = [
  makeVector("xxx", "xxx", false, 1236),
  makeVector("xxx", "xxx", false, 1235),
  makeVector("xxx", "xxx", false, 1234),
  makeVector("xxx", "xxx", true, 1005),

  makeVector("txid_4", "txid_1", true, 1004),
  makeVector("txid_1", "txid_3", true, 1004),
  makeVector("txid_3", "txid_2", true, 1004),
  makeVector("txid_2", "firstdeposit1", true, 1004),

  makeVector("xxx", "xxx", true, 1003),
  makeVector("xxx", "xxx", true, 1002),

  makeVector("txida_2", "txida_1", true, 1001),
  makeVector("txida_1", "txida_4", true, 1001),
  makeVector("txida_4", "txida_3", true, 1001),
  makeVector("txida_3", "firstdeposit2", true, 1001),
];

sortTransactions(unsorted);

assert.deepStrictEqual(unsorted, sorted, "Not equal!!!");
