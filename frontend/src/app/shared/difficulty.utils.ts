import { DifficultyAdjustment } from '@interfaces/node-api.interface';

export const EPOCH_BLOCK_LENGTH = 2016; // Bitcoin mainnet

export type BlockStatus = 'mined' | 'behind' | 'ahead' | 'next' | 'remaining';

export interface EpochState {
  epochStart: number;
  currentHeight: number;
  currentIndex: number;
  expectedHeight: number;
  expectedIndex: number;
  difference: number;
}

export interface EpochProgress {
  base: string;
  change: number;
  progress: number;
  remainingBlocks: number;
  expectedBlocks: number;
  newDifficultyHeight: number;
  colorAdjustments: string;
  colorPreviousAdjustments: string;
  estimatedRetargetDate: number;
  retargetDateString: string;
  previousRetarget: number;
  timeAvg: number;
  adjustedTimeAvg: number;
  // set by callers that render them
  minedBlocks?: number;
  blocksUntilHalving?: number;
  timeUntilHalving?: number;
}

/**
 * Resolves the colors used to highlight the upcoming and previous difficulty
 * adjustments, based on whether they are positive, negative or neutral.
 */
export function getAdjustmentColors(da: DifficultyAdjustment): {
  colorAdjustments: string;
  colorPreviousAdjustments: string;
} {
  let colorAdjustments = 'var(--transparent-fg)';
  if (da.difficultyChange > 0) {
    colorAdjustments = 'var(--green)';
  }
  if (da.difficultyChange < 0) {
    colorAdjustments = 'var(--red)';
  }

  let colorPreviousAdjustments = 'var(--red)';
  if (da.previousRetarget) {
    if (da.previousRetarget >= 0) {
      colorPreviousAdjustments = 'var(--green)';
    }
    if (da.previousRetarget === 0) {
      colorPreviousAdjustments = 'var(--transparent-fg)';
    }
  } else {
    colorPreviousAdjustments = 'var(--transparent-fg)';
  }

  return { colorAdjustments, colorPreviousAdjustments };
}

/**
 * Computes the epoch state (start height, current/expected indices and their
 * difference) for the current difficulty epoch.
 */
export function getEpochState(latestBlockHeight: number, da: DifficultyAdjustment): EpochState {
  const epochStart = Math.floor(latestBlockHeight / EPOCH_BLOCK_LENGTH) * EPOCH_BLOCK_LENGTH;
  const expectedHeight = Math.floor(epochStart + da.expectedBlocks);
  const currentHeight = latestBlockHeight;
  const currentIndex = currentHeight - epochStart;
  const expectedIndex = Math.min(expectedHeight - epochStart, EPOCH_BLOCK_LENGTH) - 1;
  const difference = currentIndex - expectedIndex;

  return { epochStart, currentHeight, currentIndex, expectedHeight, expectedIndex, difference };
}

/**
 * Formats the estimated retarget date. Once the retarget is close enough
 * (fewer than 1870 remaining blocks) the time of day is included as well.
 */
export function getRetargetDateString(da: DifficultyAdjustment, locale: string): string {
  if (da.remainingBlocks > 1870) {
    return (new Date(da.estimatedRetargetDate)).toLocaleDateString(locale, { month: 'long', day: 'numeric' });
  }
  return (new Date(da.estimatedRetargetDate)).toLocaleTimeString(locale, { month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' });
}

/**
 * Builds the common difficulty-epoch progress object shared by the difficulty
 * components. Caller-specific fields (minedBlocks and the halving fields) are
 * added by each component on top of the returned object.
 */
export function getEpochProgress(da: DifficultyAdjustment, locale: string): EpochProgress {
  const { colorAdjustments, colorPreviousAdjustments } = getAdjustmentColors(da);
  return {
    base: `${da.progressPercent.toFixed(2)}%`,
    change: da.difficultyChange,
    progress: da.progressPercent,
    remainingBlocks: da.remainingBlocks,
    expectedBlocks: Math.floor(da.expectedBlocks),
    colorAdjustments,
    colorPreviousAdjustments,
    newDifficultyHeight: da.nextRetargetHeight,
    estimatedRetargetDate: da.estimatedRetargetDate,
    retargetDateString: getRetargetDateString(da, locale),
    previousRetarget: da.previousRetarget,
    timeAvg: da.timeAvg,
    adjustedTimeAvg: da.adjustedTimeAvg,
  };
}

export function getNextBlockSubsidy(height: number): number {
  const halvings = Math.floor(height / 210_000) + 1;
  // Force block reward to zero when right shift is undefined.
  if (halvings >= 64) {
    return 0;
  }

  let subsidy = BigInt(50 * 100_000_000);
  // Subsidy is cut in half every 210,000 blocks which will occur approximately every 4 years.
  subsidy >>= BigInt(halvings);
  return Number(subsidy);
}
