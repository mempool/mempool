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
  timeOffset: number;            // (Testnet) Time since last block (cap @ 20min) in ms
  expectedBlocks: number;         // Block count
}

export function calcDifficultyAdjustment(
  DATime: number,
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

  difficultyChange = (BLOCK_SECONDS_TARGET / (actualTimespan / (blocksInEpoch + 1)) - 1) * 100;
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
  const remainingTime = remainingBlocks * timeAvg;
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

    return calcDifficultyAdjustment(
      DATime, nowSeconds, blockHeight, previousRetarget,
      config.MEMPOOL.NETWORK, latestBlock.timestamp
    );
  }
}

export default new DifficultyAdjustmentApi();
