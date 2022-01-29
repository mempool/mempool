
export interface Adjustment {
  progressPercent: number,
  difficultyChange: number,
  estimatedRetargetDate: number,
  remainingBlocks: number,
  remainingTime: number,
  previousRetarget: number,
}

export interface DifficultyInstance {
  getDifficultyAdjustment: () => Promise<Adjustment>;
}
