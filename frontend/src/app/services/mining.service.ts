import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PoolsStats, SinglePoolStats } from '../interfaces/node-api.interface';
import { ApiService } from '../services/api.service';
import { StateService } from './state.service';
import { StorageService } from './storage.service';

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
  totalBlockCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class MiningService {

  constructor(
    private stateService: StateService,
    private apiService: ApiService,
    private storageService: StorageService,
  ) { }

  /**
   * Generate pool ranking stats
   */
  public getMiningStats(interval: string): Observable<MiningStats> {
    return this.apiService.listPools$(interval).pipe(
      map(response => this.generateMiningStats(response))
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
    let selectedPower = 18;
    if (this.stateService.network === 'testnet') {
      selectedPower = 12;
    }

    return {
      hashrateDivider: Math.pow(10, selectedPower),
      hashrateUnit: powerTable[selectedPower],
    };
  }

  /**
   * Get the default selection timespan, cap with `min`
   */
  public getDefaultTimespan(min: string): string {
    const timespans = [
      '24h', '3d', '1w', '1m', '3m', '6m', '1y', '2y', '3y', 'all'
    ];
    const preference = this.storageService.getValue('miningWindowPreference') ?? '1w';
    if (timespans.indexOf(preference) < timespans.indexOf(min)) {
      return min;
    }
    return preference;
  }

  private generateMiningStats(response): MiningStats {
    const stats: PoolsStats = response.body;
    const miningUnits = this.getMiningUnits();
    const hashrateDivider = miningUnits.hashrateDivider;

    const totalEmptyBlock = Object.values(stats.pools).reduce((prev, cur) => {
      return prev + cur.emptyBlocks;
    }, 0);
    const totalEmptyBlockRatio = (totalEmptyBlock / stats.blockCount * 100).toFixed(2);
    const poolsStats = stats.pools.map((poolStat) => {
      return {
        share: parseFloat((poolStat.blockCount / stats.blockCount * 100).toFixed(2)),
        lastEstimatedHashrate: (poolStat.blockCount / stats.blockCount * stats.lastEstimatedHashrate / hashrateDivider).toFixed(2),
        emptyBlockRatio: (poolStat.emptyBlocks / poolStat.blockCount * 100).toFixed(2),
        logo: `/resources/mining-pools/` + poolStat.name.toLowerCase().replace(' ', '').replace('.', '') + '.svg',
        ...poolStat
      };
    });

    return {
      lastEstimatedHashrate: (stats.lastEstimatedHashrate / hashrateDivider).toFixed(2),
      blockCount: stats.blockCount,
      totalEmptyBlock: totalEmptyBlock,
      totalEmptyBlockRatio: totalEmptyBlockRatio,
      pools: poolsStats,
      miningUnits: miningUnits,
      totalBlockCount: parseInt(response.headers.get('x-total-count'), 10),
    };
  }
}
