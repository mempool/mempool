import config from '../config';
import logger from '../logger';
import { TransactionExtended, MempoolBlockWithTransactions } from '../mempool.interfaces';

const PROPAGATION_MARGIN = 180; // in seconds, time since a transaction is first seen after which it is assumed to have propagated to all miners

class Audit {
  auditBlock(transactions: TransactionExtended[], projectedBlocks: MempoolBlockWithTransactions[], mempool: { [txId: string]: TransactionExtended })
   : { censored: string[], added: string[], fresh: string[], sigop: string[], score: number, similarity: number } {
    if (!projectedBlocks?.[0]?.transactionIds || !mempool) {
      return { censored: [], added: [], fresh: [], sigop: [], score: 0, similarity: 1 };
    }

    const matches: string[] = []; // present in both mined block and template
    const added: string[] = []; // present in mined block, not in template
    const fresh: string[] = []; // missing, but firstSeen within PROPAGATION_MARGIN
    const sigop: string[] = []; // missing, but possibly has an adjusted vsize due to high sigop count
    const isCensored = {}; // missing, without excuse
    const isDisplaced = {};
    let displacedWeight = 0;
    let matchedWeight = 0;
    let projectedWeight = 0;

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
        } else if (this.isPossibleHighSigop(mempool[txid])) {
          sigop.push(txid);
        } else {
          isCensored[txid] = true;
        }
        displacedWeight += mempool[txid]?.weight || 0;
      } else {
        matchedWeight += mempool[txid]?.weight || 0;
      }
      projectedWeight += mempool[txid]?.weight || 0;
      inTemplate[txid] = true;
    }

    if (transactions[0]) {
      displacedWeight += (4000 - transactions[0].weight);
      projectedWeight += transactions[0].weight;
      matchedWeight += transactions[0].weight;
    }

    // we can expect an honest miner to include 'displaced' transactions in place of recent arrivals and censored txs
    // these displaced transactions should occupy the first N weight units of the next projected block
    let displacedWeightRemaining = displacedWeight;
    let index = 0;
    let lastFeeRate = Infinity;
    let failures = 0;
    while (projectedBlocks[1] && index < projectedBlocks[1].transactionIds.length && failures < 500) {
      const txid = projectedBlocks[1].transactionIds[index];
      const tx = mempool[txid];
      if (tx) {
        const fits = (tx.weight - displacedWeightRemaining) < 4000;
        const feeMatches = tx.effectiveFeePerVsize >= lastFeeRate;
        if (fits || feeMatches) {
          isDisplaced[txid] = true;
          if (fits) {
            lastFeeRate = Math.min(lastFeeRate, tx.effectiveFeePerVsize);
          }
          if (tx.firstSeen == null || (now - (tx?.firstSeen || 0)) > PROPAGATION_MARGIN) {
            displacedWeightRemaining -= tx.weight;
          }
          failures = 0;
        } else {
          failures++;
        }
      } else {
        logger.warn('projected transaction missing from mempool cache');
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
        }
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
      const tx = mempool[txid];
      if (tx) {
        if (overflowWeightRemaining > 0) {
          if (isCensored[txid]) {
            delete isCensored[txid];
          }
          if (tx.effectiveFeePerVsize > maxOverflowRate) {
            maxOverflowRate = tx.effectiveFeePerVsize;
            rateThreshold = (Math.ceil(maxOverflowRate * 100) / 100) + 0.005;
          }
        } else if (tx.effectiveFeePerVsize <= rateThreshold) { // tolerance of 0.01 sat/vb + rounding
          if (isCensored[txid]) {
            delete isCensored[txid];
          }
        }
        overflowWeightRemaining -= (mempool[txid]?.weight || 0);
      } else {
        logger.warn('projected transaction missing from mempool cache');
      }
      index--;
    }

    const numCensored = Object.keys(isCensored).length;
    const numMatches = matches.length - 1; // adjust for coinbase tx
    const score = numMatches > 0 ? (numMatches / (numMatches + numCensored)) : 0;
    const similarity = projectedWeight ? matchedWeight / projectedWeight : 1;

    return {
      censored: Object.keys(isCensored),
      added,
      fresh,
      sigop,
      score,
      similarity,
    };
  }

  // Detect transactions with a possibly adjusted vsize due to high sigop count
  // very rough heuristic based on number of OP_CHECKMULTISIG outputs
  // will miss cases with other sources of sigops
  isPossibleHighSigop(tx: TransactionExtended): boolean {
    const numBareMultisig = tx.vout.reduce((count, vout) => count + (vout.scriptpubkey_asm.includes('OP_CHECKMULTISIG') ? 1 : 0), 0);
    return (numBareMultisig * 400) > tx.vsize;
  }
}

export default new Audit();