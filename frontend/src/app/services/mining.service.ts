import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PoolsStats, SinglePoolStats } from '../interfaces/node-api.interface';
import { ApiService } from '../services/api.service';
import { StateService } from './state.service';

export interface MiningUnits {
  hashrateDivider: number;
  hashrateUnit: string;
}

export interface MiningStats {
  lastEstimatedHashrate: string;
  blockCount: number;
  totalEmptyBlock: number;
  totalEmptyBlockRatio: string;
  pools: SinglePoolStats[];
  miningUnits: MiningUnits;
  availableTimespanDay: number;
}

@Injectable({
  providedIn: 'root'
})
export class MiningService {

  constructor(
    private stateService: StateService,
    private apiService: ApiService,
  ) { }

  public getMiningStats(interval: string): Observable<MiningStats> {
    return this.apiService.listPools$(interval).pipe(
      map(pools => this.generateMiningStats(pools))
    );
  }

  /**
   * Set the hashrate power of ten we want to display
   */
  public getMiningUnits(): MiningUnits {
    const powerTable = {
      0: 'H/s',
      3: 'kH/s',
      6: 'MH/s',
      9: 'GH/s',
      12: 'TH/s',
      15: 'PH/s',
      18: 'EH/s',
    };

    // I think it's fine to hardcode this since we don't have x1000 hashrate jump everyday
    // If we want to support the mining dashboard for testnet, we can hardcode it too
    let selectedPower = 15;
    if (this.stateService.network === 'testnet') {
      selectedPower = 12;
    }

    return {
      hashrateDivider: Math.pow(10, selectedPower),
      hashrateUnit: powerTable[selectedPower],
    };
  }

  private generateMiningStats(stats: PoolsStats): MiningStats {
    const miningUnits = this.getMiningUnits();
    const hashrateDivider = miningUnits.hashrateDivider;

    const totalEmptyBlock = Object.values(stats.pools).reduce((prev, cur) => {
      return prev + cur.emptyBlocks;
    }, 0);
    const totalEmptyBlockRatio = (totalEmptyBlock / stats.blockCount * 100).toFixed(2);
    const poolsStats = stats.pools.map((poolStat) => {
      return {
        share: (poolStat.blockCount / stats.blockCount * 100).toFixed(2),
        lastEstimatedHashrate: (poolStat.blockCount / stats.blockCount * stats.lastEstimatedHashrate / hashrateDivider).toFixed(2),
        emptyBlockRatio: (poolStat.emptyBlocks / poolStat.blockCount * 100).toFixed(2),
        logo: `./resources/mining-pools/` + poolStat.name.toLowerCase().replace(' ', '').replace('.', '') + '.svg',
        ...poolStat
      };
    });

    const availableTimespanDay = (
      (new Date().getTime() / 1000) - (stats.oldestIndexedBlockTimestamp)
    ) / 3600 / 24;

    return {
      lastEstimatedHashrate: (stats.lastEstimatedHashrate / hashrateDivider).toFixed(2),
      blockCount: stats.blockCount,
      totalEmptyBlock: totalEmptyBlock,
      totalEmptyBlockRatio: totalEmptyBlockRatio,
      pools: poolsStats,
      miningUnits: miningUnits,
      availableTimespanDay: availableTimespanDay,
    };
  }
}
