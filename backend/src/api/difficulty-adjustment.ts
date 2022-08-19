import config from '../config';
import { IDifficultyAdjustment } from '../mempool.interfaces';
import blocks from './blocks';

class DifficultyAdjustmentApi {
  constructor() { }

  public getDifficultyAdjustment(): IDifficultyAdjustment {
    const ESTIMATE_LAG_BLOCKS = 146; // For first 7.2% of epoch, don't estimate.
    const EPOCH_BLOCK_LENGTH = 2016;

    const DATime = blocks.getLastDifficultyAdjustmentTime();
    const previousRetarget = blocks.getPreviousDifficultyRetarget();
    const blockHeight = blocks.getCurrentBlockHeight();
    const blocksCache = blocks.getBlocks();
    const latestBlock = blocksCache[blocksCache.length - 1];

    const nowSeconds = Math.floor(new Date().getTime() / 1000);
    const diffSeconds = nowSeconds - DATime;
    const blocksInEpoch = (blockHeight >= 0) ? blockHeight % EPOCH_BLOCK_LENGTH : 0;
    const progressPercent = (blockHeight >= 0) ? blocksInEpoch / EPOCH_BLOCK_LENGTH * 100 : 100;
    const remainingBlocks = EPOCH_BLOCK_LENGTH - blocksInEpoch;
    const nextRetargetHeight = (blockHeight >= 0) ? blockHeight + remainingBlocks : 0;

    let difficultyChange = 0;
    // Only calculate the estimate once we have 7.2% of blocks in current epoch
    if (blocksInEpoch >= ESTIMATE_LAG_BLOCKS) {
      difficultyChange = (600 / (diffSeconds / blocksInEpoch) - 1) * 100;
      // Max increase is x4 (+300%)
      if (difficultyChange > 300) {
        difficultyChange = 300;
      }
      // Max decrease is /4 (-75%)
      if (difficultyChange < -75) {
        difficultyChange = -75;
      }
    }

    let timeAvgMins = blocksInEpoch >= ESTIMATE_LAG_BLOCKS ? diffSeconds / blocksInEpoch / 60 : 10;

    // Testnet difficulty is set to 1 after 20 minutes of no blocks,
    // therefore the time between blocks will always be below 20 minutes (1200s).
    let timeOffset = 0;
    if (config.MEMPOOL.NETWORK === 'testnet') {
      if (timeAvgMins > 20) {
        timeAvgMins = 20;
      }
      if (nowSeconds - latestBlock.timestamp + timeAvgMins * 60 > 1200) {
        timeOffset = -Math.min(nowSeconds - latestBlock.timestamp, 1200) * 1000;
      }
    }

    const timeAvg = Math.floor(timeAvgMins * 60 * 1000);
    const remainingTime = remainingBlocks * timeAvg;
    const estimatedRetargetDate = remainingTime + nowSeconds * 1000;

    return {
      progressPercent,
      difficultyChange,
      estimatedRetargetDate,
      remainingBlocks,
      remainingTime,
      previousRetarget,
      nextRetargetHeight,
      timeAvg,
      timeOffset,
    };
  }
}

export default new DifficultyAdjustmentApi();
