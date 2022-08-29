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
const unsorted1 = [
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
const unsorted2 = unsorted1.slice();

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

const sortedBackwards = [
  makeVector("txida_3", "firstdeposit2", true, 1001),
  makeVector("txida_4", "txida_3", true, 1001),
  makeVector("txida_1", "txida_4", true, 1001),
  makeVector("txida_2", "txida_1", true, 1001),

  makeVector("xxx", "xxx", true, 1002),
  makeVector("xxx", "xxx", true, 1003),
  
  makeVector("txid_2", "firstdeposit1", true, 1004),
  makeVector("txid_3", "txid_2", true, 1004),
  makeVector("txid_1", "txid_3", true, 1004),
  makeVector("txid_4", "txid_1", true, 1004),
  
  makeVector("xxx", "xxx", true, 1005),
  makeVector("xxx", "xxx", false, 1234),
  makeVector("xxx", "xxx", false, 1235),
  makeVector("xxx", "xxx", false, 1236),
];

// Sort with descending order (default, newest transaction is index 0)
sortTransactions(unsorted1);
assert.deepStrictEqual(unsorted1, sorted, "Not equal!!!");

// Sort with ascending order (oldest transaction is index 0)
sortTransactions(unsorted2, true);
assert.deepStrictEqual(unsorted2, sortedBackwards, "Not equal!!!");
