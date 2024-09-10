import { Injectable } from '@angular/core';
import { AccelerationPosition, CpfpInfo, DifficultyAdjustment, MempoolPosition, OptimizedMempoolStats, SinglePoolStats } from '../interfaces/node-api.interface';
import { StateService } from './state.service';
import { MempoolBlock } from '../interfaces/websocket.interface';
import { Transaction } from '../interfaces/electrs.interface';
import { MiningService, MiningStats } from './mining.service';
import { getUnacceleratedFeeRate } from '../shared/transaction.utils';
import { AccelerationEstimate } from '../components/accelerate-checkout/accelerate-checkout.component';
import { Observable, combineLatest, map, of, share, shareReplay, tap } from 'rxjs';
import { feeLevels } from '../app.constants';

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
    private miningService: MiningService,
  ) { }

  getProjectedEtaObservable(estimate: AccelerationEstimate, miningStats?: MiningStats): Observable<{ hashratePercentage: number, ETA: number, acceleratedETA: number }> {
    return combineLatest([
      this.stateService.mempoolTxPosition$.pipe(map(p => p?.position)),
      this.stateService.difficultyAdjustment$,
      miningStats ? of(miningStats) : this.miningService.getMiningStats('1w'),
    ]).pipe(
      map(([mempoolPosition, da, miningStats]) => {
        if (!mempoolPosition || !estimate?.pools?.length || !miningStats || !da) {
          return {
            hashratePercentage: undefined,
            ETA: undefined,
            acceleratedETA: undefined,
          };
        }
        const pools: { [id: number]: SinglePoolStats } = {};
        for (const pool of miningStats.pools) {
          pools[pool.poolUniqueId] = pool;
        }

        let totalAcceleratedHashrate = 0;
        for (const poolId of estimate.pools) {
          const pool = pools[poolId];
          if (!pool) {
            continue;
          }
          totalAcceleratedHashrate += pool.lastEstimatedHashrate;
        }
        const acceleratingHashrateFraction = (totalAcceleratedHashrate / miningStats.lastEstimatedHashrate);

        return {
          hashratePercentage: acceleratingHashrateFraction * 100,
          ETA: Date.now() + da.timeAvg * mempoolPosition.block,
          acceleratedETA: this.calculateETAFromShares([
            { block: mempoolPosition.block, hashrateShare: (1 - acceleratingHashrateFraction) },
            { block: 0, hashrateShare: acceleratingHashrateFraction },
          ], da).time,
        };
      }),
      shareReplay()
    );
  }

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
          };
        }
      }
      if (feerate >= block.feeRange[block.feeRange.length - 1]) {
        // at the very front of this block
        return {
          block: txInBlockIndex,
          vsize: 0,
        };
      }
    }
    // at the very back of the last block
    return {
      block: mempoolBlocks.length - 1,
      vsize: mempoolBlocks[mempoolBlocks.length - 1].blockVSize,
    };
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
    mempoolStats: OptimizedMempoolStats[] = [],
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
      };
    }

    // difficulty adjustment estimate is required to know avg block time on non-Liquid networks
    if (!da) {
      return null;
    }

    if (!isAccelerated) {
      const blocks = mempoolPosition.block + 1;

      const vsizeAhead = mempoolPosition.vsize + this.stateService.blockVSize * mempoolPosition.block;
      const incomingVsizePerBlock = this.estimateVsizePerSecond(tx, mempoolStats) * da.adjustedTimeAvg / 1000;
      const vsizeConsumedPerBlock = Math.max(
        this.stateService.blockVSize - incomingVsizePerBlock,
        0.05 * this.stateService.blockVSize // So that we don't return infinite ETA
      )

      const blocksUntilMined = Math.ceil(vsizeAhead / vsizeConsumedPerBlock);
      const wait = blocksUntilMined * da.adjustedTimeAvg;

      return {
        now,
        time: wait + now + da.timeOffset,
        wait,
        blocks,
      };
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
      const pools: { [id: number]: SinglePoolStats } = {};
      for (const pool of miningStats.pools) {
        pools[pool.poolUniqueId] = pool;
      }
      const unacceleratedPosition = this.mempoolPositionFromFees(getUnacceleratedFeeRate(tx, true), mempoolBlocks);
      const totalAcceleratedHashrate = accelerationPositions.reduce((total, pos) => total + (pools[pos.poolId].lastEstimatedHashrate), 0);
      const shares = [
        {
          block: unacceleratedPosition.block,
          hashrateShare: (1 - (totalAcceleratedHashrate / miningStats.lastEstimatedHashrate)),
        },
        ...accelerationPositions.map(pos => ({
          block: pos.block,
          hashrateShare: ((pools[pos.poolId].lastEstimatedHashrate) / miningStats.lastEstimatedHashrate)
        }))
      ];
      return this.calculateETAFromShares(shares, da);
    }
  }

  /**
   *
      - Let $\{C_i\}$ be the set of pools.
      - $P(C_i)$ is the probability that a random block belongs to pool $C_i$.
      - $N(C_i)$ is the number of blocks that need to be mined before a block by pool $C_i$ contains the given transaction.
      - $H(n)$ is the proportion of hashrate for which the transaction is in mempool block ≤ $n$
      - $S(n)$ is the probability of the transaction being mined in block $n$
        - by definition, $S(max) = 1$ , where $max$ is the maximum depth of the transaction in any mempool, and therefore $S(n>max) = 0$
      - $Q$ is the expected number of blocks before the transaction is confirmed
      - $E$ is the expected time before the transaction is confirmed

      - $S(i) = H(i) \times (1 - \sum_{j=0}^{i-1} S(j))$
        - the probability of mining a block including the transaction at this depth, multiplied by the probability that it hasn't already been mined at an earlier depth.
      - $Q = \sum_{i=0}^{max} S(i) \times (i+1)$
        - number of blocks, weighted by the probability that the block includes the transaction
      - $E = Q \times T$
        - expected number of blocks, multiplied by the avg time per block
    */
  calculateETAFromShares(shares: { block: number, hashrateShare: number }[], da: DifficultyAdjustment, now: number = Date.now()): ETA {
      const max = shares.reduce((max, share) => Math.max(max, share.block), 0);

      let tailProb = 0;
      let Q = 0;
      for (let i = 0; i < max; i++) {
        // find H_i
        const H = shares.reduce((total, share) => total + (share.block <= i ? share.hashrateShare : 0), 0);
        // find S_i
        const S = H * (1 - tailProb);
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
      };
  }

  calculateUnacceleratedETA(
    tx: Transaction,
    mempoolBlocks: MempoolBlock[],
    da: DifficultyAdjustment,
    cpfpInfo: CpfpInfo | null,
  ): ETA | null {
    if (!tx || !mempoolBlocks) {
      return null;
    }
    const now = Date.now();

    // use known projected position, or fall back to feerate-based estimate
    const mempoolPosition = this.mempoolPositionFromFees(this.getFeeRateFromCpfpInfo(tx, cpfpInfo), mempoolBlocks);
    if (!mempoolPosition) {
      return null;
    }

    // difficulty adjustment estimate is required to know avg block time on non-Liquid networks
    if (!da) {
      return null;
    }

    const blocks = mempoolPosition.block + 1;
    const wait = da.adjustedTimeAvg * (mempoolPosition.block + 1);
    return {
      now,
      time: wait + now + da.timeOffset,
      wait,
      blocks,
    };
  }


  getFeeRateFromCpfpInfo(tx: Transaction, cpfpInfo: CpfpInfo | null): number {
    if (!cpfpInfo) {
      return tx.fee / (tx.weight / 4);
    }

    const relatives = [...(cpfpInfo.ancestors || []), ...(cpfpInfo.descendants || [])];
    if (cpfpInfo.bestDescendant && !cpfpInfo.descendants?.length) {
      relatives.push(cpfpInfo.bestDescendant);
    }

    if (!!relatives.length) {
      const totalWeight = tx.weight + relatives.reduce((prev, val) => prev + val.weight, 0);
      const totalFees = tx.fee + relatives.reduce((prev, val) => prev + val.fee, 0);

      return totalFees / (totalWeight / 4);
    }

    return tx.fee / (tx.weight / 4);

  }

  estimateVsizePerSecond(tx: Transaction, mempoolStats: OptimizedMempoolStats[], timeWindow: number = 15 * 60 * 1000): number {
    const nowMinusTimeSpan = (new Date().getTime() - timeWindow) / 1000;
    const vsizeAboveTransaction = mempoolStats
      // Remove datapoints older than now - timeWindow
      .filter(stat => stat.added > nowMinusTimeSpan)
      // Remove datapoints less than 45 seconds apart from the previous one
      .filter((el, i, arr) => {
        if (i === 0) {
          return true;
        }
        return arr[i - 1].added - el.added > 45;
      })
      // For each datapoint, compute the total vsize of transactions with higher fee rate
      .map(stat => {
        let vsizeAbove = 0;
        for (let i = feeLevels.length - 1; i >= 0; i--) {
          if (feeLevels[i] > tx.effectiveFeePerVsize) {
            vsizeAbove += stat.vsizes_ps[i];
          } else {
            break;
          }
        }
        return vsizeAbove;
      });
    
    // vsizeAboveTransaction is a temporal series of past vsize values above the transaction's fee rate
    // From this array we need to estimate the future vsize per second
    // Naive first approach: take the median of the series
    if (!vsizeAboveTransaction.length) {
      return 0;
    }

    const sorted = Array.from(vsizeAboveTransaction).sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }

    return sorted[middle];
  }
}
