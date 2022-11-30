import config from '../config';
import bitcoinApi from './bitcoin/bitcoin-api-factory';
import { Common } from './common';
import { TransactionExtended, MempoolBlockWithTransactions, AuditScore } from '../mempool.interfaces';
import blocksRepository from '../repositories/BlocksRepository';
import blocksAuditsRepository from '../repositories/BlocksAuditsRepository';
import blocks from '../api/blocks';

const PROPAGATION_MARGIN = 180; // in seconds, time since a transaction is first seen after which it is assumed to have propagated to all miners

class Audit {
  auditBlock(transactions: TransactionExtended[], projectedBlocks: MempoolBlockWithTransactions[], mempool: { [txId: string]: TransactionExtended })
   : { censored: string[], added: string[], fresh: string[], score: number } {
    if (!projectedBlocks?.[0]?.transactionIds || !mempool) {
      return { censored: [], added: [], fresh: [], score: 0 };
    }

    const matches: string[] = []; // present in both mined block and template
    const added: string[] = []; // present in mined block, not in template
    const fresh: string[] = []; // missing, but firstSeen within PROPAGATION_MARGIN
    const isCensored = {}; // missing, without excuse
    const isDisplaced = {};
    let displacedWeight = 0;

    const inBlock = {};
    const inTemplate = {};

    const now = Math.round((Date.now() / 1000));
    for (const tx of transactions) {
      inBlock[tx.txid] = tx;
    }
    // coinbase is always expected
    if (transactions[0]) {
      inTemplate[transactions[0].txid] = true;
    }
    // look for transactions that were expected in the template, but missing from the mined block
    for (const txid of projectedBlocks[0].transactionIds) {
      if (!inBlock[txid]) {
        // tx is recent, may have reached the miner too late for inclusion
        if (mempool[txid]?.firstSeen != null && (now - (mempool[txid]?.firstSeen || 0)) <= PROPAGATION_MARGIN) {
          fresh.push(txid);
        } else {
          isCensored[txid] = true;
        }
        displacedWeight += mempool[txid].weight;
      }
      inTemplate[txid] = true;
    }

    displacedWeight += (4000 - transactions[0].weight);

    // we can expect an honest miner to include 'displaced' transactions in place of recent arrivals and censored txs
    // these displaced transactions should occupy the first N weight units of the next projected block
    let displacedWeightRemaining = displacedWeight;
    let index = 0;
    let lastFeeRate = Infinity;
    let failures = 0;
    while (projectedBlocks[1] && index < projectedBlocks[1].transactionIds.length && failures < 500) {
      const txid = projectedBlocks[1].transactionIds[index];
      const fits = (mempool[txid].weight - displacedWeightRemaining) < 4000;
      const feeMatches = mempool[txid].effectiveFeePerVsize >= lastFeeRate;
      if (fits || feeMatches) {
        isDisplaced[txid] = true;
        if (fits) {
          lastFeeRate = Math.min(lastFeeRate, mempool[txid].effectiveFeePerVsize);
        }
        if (mempool[txid].firstSeen == null || (now - (mempool[txid]?.firstSeen || 0)) > PROPAGATION_MARGIN) {
          displacedWeightRemaining -= mempool[txid].weight;
        }
        failures = 0;
      } else {
        failures++;
      }
      index++;
    }

    // mark unexpected transactions in the mined block as 'added'
    let overflowWeight = 0;
    let totalWeight = 0;
    for (const tx of transactions) {
      if (inTemplate[tx.txid]) {
        matches.push(tx.txid);
      } else {
        if (!isDisplaced[tx.txid]) {
          added.push(tx.txid);
        } else {
        }
        let blockIndex = -1;
        let index = -1;
        projectedBlocks.forEach((block, bi) => {
          const i = block.transactionIds.indexOf(tx.txid);
          if (i >= 0) {
            blockIndex = bi;
            index = i;
          }
        });
        overflowWeight += tx.weight;
      }
      totalWeight += tx.weight;
    }

    // transactions missing from near the end of our template are probably not being censored
    let overflowWeightRemaining = overflowWeight - (config.MEMPOOL.BLOCK_WEIGHT_UNITS - totalWeight);
    let maxOverflowRate = 0;
    let rateThreshold = 0;
    index = projectedBlocks[0].transactionIds.length - 1;
    while (index >= 0) {
      const txid = projectedBlocks[0].transactionIds[index];
      if (overflowWeightRemaining > 0) {
        if (isCensored[txid]) {
          delete isCensored[txid];
        }
        if (mempool[txid].effectiveFeePerVsize > maxOverflowRate) {
          maxOverflowRate = mempool[txid].effectiveFeePerVsize;
          rateThreshold = (Math.ceil(maxOverflowRate * 100) / 100) + 0.005;
        }
      } else if (mempool[txid].effectiveFeePerVsize <= rateThreshold) { // tolerance of 0.01 sat/vb + rounding
        if (isCensored[txid]) {
          delete isCensored[txid];
        }
      }
      overflowWeightRemaining -= (mempool[txid]?.weight || 0);
      index--;
    }

    const numCensored = Object.keys(isCensored).length;
    const score = matches.length > 0 ? (matches.length / (matches.length + numCensored)) : 0;

    return {
      censored: Object.keys(isCensored),
      added,
      fresh,
      score
    };
  }
}

export default new Audit();