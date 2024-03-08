import config from '../config';
import { IDifficultyAdjustment } from '../mempool.interfaces';
import blocks from './blocks';

export interface DifficultyAdjustment {
  progressPercent: number;       // Percent: 0 to 100
  difficultyChange: number;      // Percent: -75 to 300
  estimatedRetargetDate: number; // Unix time in ms
  remainingBlocks: number;       // Block count
  remainingTime: number;         // Duration of time in ms
  previousRetarget: number;      // Percent: -75 to 300
  previousTime: number;          // Unix time in ms
  nextRetargetHeight: number;    // Block Height
  timeAvg: number;               // Duration of time in ms
  adjustedTimeAvg;               // Expected block interval with hashrate implied over last 504 blocks
  timeOffset: number;            // (Testnet) Time since last block (cap @ 20min) in ms
  expectedBlocks: number;         // Block count
}

/**
 * Calculate the difficulty increase/decrease by using the `bits` integer contained in two
 * block headers.
 *
 * Warning: Only compare `bits` from blocks in two adjacent difficulty periods. This code
 * assumes the maximum difference is x4 or /4 (as per the protocol) and will throw an
 * error if an exponent difference of 2 or more is seen.
 *
 * @param {number} oldBits The 32 bit `bits` integer from a block header.
 * @param {number} newBits The 32 bit `bits` integer from a block header in the next difficulty period.
 * @returns {number} A floating point decimal of the difficulty change from old to new.
 *          (ie. 21.3 means 21.3% increase in difficulty, -21.3 is a 21.3% decrease in difficulty)
 */
export function calcBitsDifference(oldBits: number, newBits: number): number {
  // Must be
  // - integer
  // - highest exponent is 0x20, so max value (as integer) is 0x207fffff
  // - min value is 1 (exponent = 0)
  // - highest bit of the number-part is +- sign, it must not be 1
  const verifyBits = (bits: number): void => {
    if (
      Math.floor(bits) !== bits ||
      bits > 0x207fffff ||
      bits < 1 ||
      (bits & 0x00800000) !== 0 ||
      (bits & 0x007fffff) === 0
    ) {
      throw new Error('Invalid bits');
    }
  };
  verifyBits(oldBits);
  verifyBits(newBits);

  // No need to mask exponents because we checked the bounds above
  const oldExp = oldBits >> 24;
  const newExp = newBits >> 24;
  const oldNum = oldBits & 0x007fffff;
  const newNum = newBits & 0x007fffff;
  // The diff can only possibly be 1, 0, -1
  // (because maximum difficulty change is x4 or /4 (2 bits up or down))
  let result: number;
  switch (newExp - oldExp) {
    // New less than old, target lowered, difficulty increased
    case -1:
      result = ((oldNum << 8) * 100) / newNum - 100;
      break;
    // Same exponent, compare numbers as is.
    case 0:
      result = (oldNum * 100) / newNum - 100;
      break;
    // Old less than new, target raised, difficulty decreased
    case 1:
      result = (oldNum * 100) / (newNum << 8) - 100;
      break;
    default:
      throw new Error('Impossible exponent difference');
  }

  // Min/Max values
  return result > 300 ? 300 : result < -75 ? -75 : result;
}

export function calcDifficultyAdjustment(
  DATime: number,
  quarterEpochTime: number | null,
  nowSeconds: number,
  blockHeight: number,
  previousRetarget: number,
  network: string,
  latestBlockTimestamp: number,
): DifficultyAdjustment {
  const EPOCH_BLOCK_LENGTH = 2016; // Bitcoin mainnet
  const BLOCK_SECONDS_TARGET = 600; // Bitcoin mainnet
  const TESTNET_MAX_BLOCK_SECONDS = 1200; // Bitcoin testnet

  const diffSeconds = Math.max(0, nowSeconds - DATime);
  const blocksInEpoch = (blockHeight >= 0) ? blockHeight % EPOCH_BLOCK_LENGTH : 0;
  const progressPercent = (blockHeight >= 0) ? blocksInEpoch / EPOCH_BLOCK_LENGTH * 100 : 100;
  const remainingBlocks = EPOCH_BLOCK_LENGTH - blocksInEpoch;
  const nextRetargetHeight = (blockHeight >= 0) ? blockHeight + remainingBlocks : 0;
  const expectedBlocks = diffSeconds / BLOCK_SECONDS_TARGET;
  const actualTimespan = (blocksInEpoch === 2015 ? latestBlockTimestamp : nowSeconds) - DATime;

  let difficultyChange = 0;
  let timeAvgSecs = blocksInEpoch ? diffSeconds / blocksInEpoch : BLOCK_SECONDS_TARGET;
  let adjustedTimeAvgSecs = timeAvgSecs;

  // for the first 504 blocks of the epoch, calculate the expected avg block interval
  // from a sliding window over the last 504 blocks
  if (quarterEpochTime && blocksInEpoch < 503) {
    const timeLastEpoch = DATime - quarterEpochTime;
    const adjustedTimeLastEpoch = timeLastEpoch * (1 + (previousRetarget / 100));
    const adjustedTimeSpan = diffSeconds + adjustedTimeLastEpoch;
    adjustedTimeAvgSecs = adjustedTimeSpan / 503;
    difficultyChange = (BLOCK_SECONDS_TARGET / (adjustedTimeSpan / 504) - 1) * 100;
  } else {
    difficultyChange = (BLOCK_SECONDS_TARGET / (actualTimespan / (blocksInEpoch + 1)) - 1) * 100;
  }

  // Max increase is x4 (+300%)
  if (difficultyChange > 300) {
    difficultyChange = 300;
  }
  // Max decrease is /4 (-75%)
  if (difficultyChange < -75) {
    difficultyChange = -75;
  }

  // Testnet difficulty is set to 1 after 20 minutes of no blocks,
  // therefore the time between blocks will always be below 20 minutes (1200s).
  let timeOffset = 0;
  if (network === 'testnet') {
    if (timeAvgSecs > TESTNET_MAX_BLOCK_SECONDS) {
      timeAvgSecs = TESTNET_MAX_BLOCK_SECONDS;
    }

    const secondsSinceLastBlock = nowSeconds - latestBlockTimestamp;
    if (secondsSinceLastBlock + timeAvgSecs > TESTNET_MAX_BLOCK_SECONDS) {
      timeOffset = -Math.min(secondsSinceLastBlock, TESTNET_MAX_BLOCK_SECONDS) * 1000;
    }
  }

  const timeAvg = Math.floor(timeAvgSecs * 1000);
  const adjustedTimeAvg = Math.floor(adjustedTimeAvgSecs * 1000);
  const remainingTime = remainingBlocks * adjustedTimeAvg;
  const estimatedRetargetDate = remainingTime + nowSeconds * 1000;

  return {
    progressPercent,
    difficultyChange,
    estimatedRetargetDate,
    remainingBlocks,
    remainingTime,
    previousRetarget,
    previousTime: DATime,
    nextRetargetHeight,
    timeAvg,
    adjustedTimeAvg,
    timeOffset,
    expectedBlocks,
  };
}

class DifficultyAdjustmentApi {
  public getDifficultyAdjustment(): IDifficultyAdjustment | null {
    const DATime = blocks.getLastDifficultyAdjustmentTime();
    const previousRetarget = blocks.getPreviousDifficultyRetarget();
    const blockHeight = blocks.getCurrentBlockHeight();
    const blocksCache = blocks.getBlocks();
    const latestBlock = blocksCache[blocksCache.length - 1];
    if (!latestBlock) {
      return null;
    }
    const nowSeconds = Math.floor(new Date().getTime() / 1000);
    const quarterEpochBlockTime = blocks.getQuarterEpochBlockTime();

    return calcDifficultyAdjustment(
      DATime, quarterEpochBlockTime, nowSeconds, blockHeight, previousRetarget,
      config.MEMPOOL.NETWORK, latestBlock.timestamp
    );
  }
}

export default new DifficultyAdjustmentApi();
