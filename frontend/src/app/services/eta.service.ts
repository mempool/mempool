import { Injectable } from '@angular/core';
import { AccelerationPosition, CpfpInfo, DifficultyAdjustment, MempoolPosition, SinglePoolStats } from '../interfaces/node-api.interface';
import { StateService } from './state.service';
import { MempoolBlock } from '../interfaces/websocket.interface';
import { Transaction } from '../interfaces/electrs.interface';
import { MiningStats } from './mining.service';
import { getUnacceleratedFeeRate } from '../shared/transaction.utils';

export interface ETA {
  now: number, // time at which calculation performed
  time: number, // absolute time expected (in unix epoch ms)
  wait: number, // expected wait time in ms
  blocks: number, // expected number of blocks (rounded up to next integer)
}

@Injectable({
  providedIn: 'root'
})
export class EtaService {
  constructor(
    private stateService: StateService,
  ) { }

  mempoolPositionFromFees(feerate: number, mempoolBlocks: MempoolBlock[]): MempoolPosition {
    for (let txInBlockIndex = 0; txInBlockIndex < mempoolBlocks.length; txInBlockIndex++) {
      const block = mempoolBlocks[txInBlockIndex];
      for (let i = 0; i < block.feeRange.length - 1; i++) {
        if (feerate < block.feeRange[i + 1] && feerate >= block.feeRange[i]) {
          const feeRangeIndex = i;
          const feeRangeChunkSize = 1 / (block.feeRange.length - 1);

          const txFee = feerate - block.feeRange[i];
          const max = block.feeRange[i + 1] - block.feeRange[i];
          const blockLocation = txFee / max;

          const chunkPositionOffset = blockLocation * feeRangeChunkSize;
          const feePosition = feeRangeChunkSize * feeRangeIndex + chunkPositionOffset;

          const blockedFilledPercentage = (block.blockVSize > this.stateService.blockVSize ? this.stateService.blockVSize : block.blockVSize) / this.stateService.blockVSize;

          return {
            block: txInBlockIndex,
            vsize: (1 - feePosition) * blockedFilledPercentage * this.stateService.blockVSize,
          }
        }
      }
      if (feerate >= block.feeRange[block.feeRange.length - 1]) {
        // at the very front of this block
        return {
          block: txInBlockIndex,
          vsize: 0,
        }
      }
    }
    // at the very back of the last block
    return {
      block: mempoolBlocks.length - 1,
      vsize: mempoolBlocks[mempoolBlocks.length - 1].blockVSize,
    }
  }

  calculateETA(
    network: string,
    tx: Transaction,
    mempoolBlocks: MempoolBlock[],
    position: { txid: string, position: MempoolPosition, cpfp: CpfpInfo | null, accelerationPositions?: AccelerationPosition[] },
    da: DifficultyAdjustment,
    miningStats: MiningStats,
    isAccelerated: boolean,
    accelerationPositions: AccelerationPosition[],
  ): ETA | null {
    // return this.calculateETA(tx, this.accelerationPositions, position, mempoolBlocks, da, isAccelerated)
    if (!tx || !mempoolBlocks) {
      return null;
    }
    const now = Date.now();

    // use known projected position, or fall back to feerate-based estimate
    const mempoolPosition = position?.position ?? this.mempoolPositionFromFees(tx.effectiveFeePerVsize || tx.feePerVsize, mempoolBlocks);
    if (!mempoolPosition) {
      return null;
    }

    // Liquid block time is always 60 seconds
    if (network === 'liquid' || network === 'liquidtestnet') {
      return {
        now,
        time: now + (60_000 * (mempoolPosition.block + 1)),
        wait: (60_000 * (mempoolPosition.block + 1)),
        blocks: mempoolPosition.block + 1,
      }
    }

    // difficulty adjustment estimate is required to know avg block time on non-Liquid networks
    if (!da) {
      return null;
    }

    if (!isAccelerated) {
      const blocks = mempoolPosition.block + 1;
      const wait = da.adjustedTimeAvg * (mempoolPosition.block + 1);
      return {
        now,
        time: wait + now + da.timeOffset,
        wait,
        blocks,
      }
    } else {
      // accelerated transactions

      // mining stats are required for pool hashrate weightings
      if (!miningStats) {
        return null;
      }
      // acceleration positions are required
      if (!accelerationPositions) {
        return null;
      }

      /**
       *  **Define parameters**
            - Let $\{C_i\}$ be the set of pools.
            - $P(C_i)$ is the probability that a random block belongs to pool $C_i$.
            - $N(C_i)$ is the number of blocks that need to be mined before a block by pool $C_i$ contains the given transaction.
            - $H(n)$ is the proportion of hashrate for which the transaction is in mempool block ≤ $n$
            - $S(n)$ is the probability of the transaction being mined in block $n$
              - by definition, $S(max) = 1$ , where $max$ is the maximum depth of the transaction in any mempool, and therefore $S(n>max) = 0$
            - $Q$ is the expected number of blocks before the transaction is confirmed
            - $E$ is the expected time before the transaction is confirmed
          **Overall expected confirmation time**
            - $S(i) = H(i) \times (1 - \sum_{j=0}^{i-1} S(j))$
              - the probability of mining a block including the transaction at this depth, multiplied by the probability that it hasn't already been mined at an earlier depth.
            - $Q = \sum_{i=0}^{max} S(i) \times (i+1)$
              - number of blocks, weighted by the probability that the block includes the transaction
            - $E = Q \times T$
              - expected number of blocks, multiplied by the avg time per block
       */
      const pools: { [id: number]: SinglePoolStats } = {};
      for (const pool of miningStats.pools) {
        pools[pool.poolUniqueId] = pool;
      }
      const unacceleratedPosition = this.mempoolPositionFromFees(getUnacceleratedFeeRate(tx, true), mempoolBlocks);
      const positions = [unacceleratedPosition, ...accelerationPositions];
      const max = unacceleratedPosition.block; // by definition, assuming no negative fee deltas or out of band txs

      let tailProb = 0;
      let Q = 0;
      for (let i = 0; i < max; i++) {
        // find H_i
        const H = accelerationPositions.reduce((total, pos) => total + (pos.block <= i ? pools[pos.poolId].lastEstimatedHashrate : 0), 0) / miningStats.lastEstimatedHashrate;
        // find S_i
        let S = H * (1 - tailProb);
        // accumulate sum (S_i x i)
        Q += (S * (i + 1));
        // accumulate sum (S_j)
        tailProb += S;
      }
      // at max depth, the transaction is guaranteed to be mined in the next block if it hasn't already
      Q += (1-tailProb);
      const eta = da.timeAvg * Q; // T x Q

      return {
        now,
        time: eta + now + da.timeOffset,
        wait: eta,
        blocks: Math.ceil(eta / da.adjustedTimeAvg),
      }
    }
  }
}
