import config from '../config';
import { IDifficultyAdjustment } from '../mempool.interfaces';
import blocks from './blocks';

class DifficultyAdjustmentApi {
  constructor() { }

  public getDifficultyAdjustment(): IDifficultyAdjustment {
    const DATime = blocks.getLastDifficultyAdjustmentTime();
    const previousRetarget = blocks.getPreviousDifficultyRetarget();
    const blockHeight = blocks.getCurrentBlockHeight();
    const blocksCache = blocks.getBlocks();
    const latestBlock = blocksCache[blocksCache.length - 1];

    const now = new Date().getTime() / 1000;
    const diff = now - DATime;
    const blocksInEpoch = blockHeight % 2016;
    const progressPercent = (blocksInEpoch >= 0) ? blocksInEpoch / 2016 * 100 : 100;
    const remainingBlocks = 2016 - blocksInEpoch;
    const nextRetargetHeight = blockHeight + remainingBlocks;

    let difficultyChange = 0;
    if (remainingBlocks < 1870) {
      if (blocksInEpoch > 0) {
        difficultyChange = (600 / (diff / blocksInEpoch) - 1) * 100;
      }
      if (difficultyChange > 300) {
        difficultyChange = 300;
      }
      if (difficultyChange < -75) {
        difficultyChange = -75;
      }
    }

    let timeAvgMins = blocksInEpoch && blocksInEpoch > 146 ? diff / blocksInEpoch / 60 : 10;

    // Testnet difficulty is set to 1 after 20 minutes of no blocks,
    // therefore the time between blocks will always be below 20 minutes (1200s).
    let timeOffset = 0;
    if (config.MEMPOOL.NETWORK === 'testnet') {
      if (timeAvgMins > 20) {
        timeAvgMins = 20;
      }
      if (now - latestBlock.timestamp + timeAvgMins * 60 > 1200) {
        timeOffset = -Math.min(now - latestBlock.timestamp, 1200) * 1000;
      }
    }

    const timeAvg = timeAvgMins * 60 * 1000 ;
    const remainingTime = remainingBlocks * timeAvg;
    const estimatedRetargetDate = remainingTime + now * 1000;

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
