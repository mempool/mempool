import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { PoolsStats, SinglePoolStats } from '@interfaces/node-api.interface';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { StorageService } from '@app/services/storage.service';

export interface MiningUnits {
  hashrateDivider: number;
  hashrateUnit: string;
}

export interface MiningStats {
  lastEstimatedHashrate: number;
  lastEstimatedHashrate3d: number;
  lastEstimatedHashrate1w: number;
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
  cache: {
    [interval: string]: {
      lastUpdated: number;
      data: MiningStats;
    }
  } = {};
  poolsData: SinglePoolStats[] = [];

  constructor(
    private stateService: StateService,
    private apiService: ApiService,
    private storageService: StorageService,
  ) {
    this.stateService.networkChanged$.subscribe((network) => {
      this.clearCache();
    });
   }

  /**
   * Generate pool ranking stats
   */
  public getMiningStats(interval: string): Observable<MiningStats> {
    // returned cached data fetched within the last 5 minutes
    if (this.cache[interval] && this.cache[interval].lastUpdated > (Date.now() - (5 * 60000))) {
      return of(this.cache[interval].data);
    } else {
      return this.apiService.listPools$(interval).pipe(
        map(response => this.generateMiningStats(response)),
        tap(stats => {
          this.cache[interval] = {
            lastUpdated: Date.now(),
            data: stats,
          };
        })
      );
    }
  }
  
  /** 
   * Get names and slugs of all pools
   */
  public getPools(): Observable<any[]> {
    return this.poolsData.length ? of(this.poolsData) : this.apiService.listPools$(undefined).pipe(
      map(response => {
        this.poolsData = response.body;
        return this.poolsData;
      })
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
    if (this.stateService.network === 'testnet' || this.stateService.network === 'testnet4') {
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
        lastEstimatedHashrate: poolStat.blockCount / stats.blockCount * stats.lastEstimatedHashrate / hashrateDivider,
        lastEstimatedHashrate3d: poolStat.blockCount / stats.blockCount * stats.lastEstimatedHashrate3d / hashrateDivider,
        lastEstimatedHashrate1w: poolStat.blockCount / stats.blockCount * stats.lastEstimatedHashrate1w / hashrateDivider,
        emptyBlockRatio: (poolStat.emptyBlocks / poolStat.blockCount * 100).toFixed(2),
        logo: `/resources/mining-pools/` + poolStat.slug + '.svg',
        ...poolStat
      };
    });

    return {
      lastEstimatedHashrate: stats.lastEstimatedHashrate / hashrateDivider,
      lastEstimatedHashrate3d: stats.lastEstimatedHashrate3d / hashrateDivider,
      lastEstimatedHashrate1w: stats.lastEstimatedHashrate1w / hashrateDivider,
      blockCount: stats.blockCount,
      totalEmptyBlock: totalEmptyBlock,
      totalEmptyBlockRatio: totalEmptyBlockRatio,
      pools: poolsStats,
      miningUnits: miningUnits,
      totalBlockCount: parseInt(response.headers.get('x-total-count'), 10),
    };
  }

  private clearCache(): void {
    this.cache = {};
    this.poolsData = [];
  }
}
