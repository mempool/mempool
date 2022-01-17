import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MiningStats, PoolsStats } from '../interfaces/node-api.interface';
import { ApiService } from '../services/api.service';

@Injectable({
  providedIn: 'root'
})
export class MiningService {

  constructor(
    private apiService: ApiService,
  ) { }

  public getMiningStats(interval: string): Observable<MiningStats> {
    return this.apiService.listPools$(interval).pipe(
      map(pools => this.generateMiningStats(pools))
    );
  }

  private generateMiningStats(stats: PoolsStats) : MiningStats {
    const totalEmptyBlock = Object.values(stats.pools).reduce((prev, cur) => {
      return prev + cur.emptyBlocks;
    }, 0);
    const totalEmptyBlockRatio = (totalEmptyBlock / stats.blockCount * 100).toFixed(2);
    const poolsStats = stats.pools.map((poolStat) => {
      return {
        share: (poolStat.blockCount / stats.blockCount * 100).toFixed(2),
        lastEstimatedHashrate: (poolStat.blockCount / stats.blockCount * stats.lastEstimatedHashrate / Math.pow(10, 15)).toFixed(2),
        emptyBlockRatio: (poolStat.emptyBlocks / poolStat.blockCount * 100).toFixed(2),
        logo: `./resources/mining-pools/` + poolStat.name.toLowerCase().replace(' ', '').replace('.', '') + '.svg',
        ...poolStat
      }
    });

    return {
      lastEstimatedHashrate: (stats.lastEstimatedHashrate / Math.pow(10, 15)).toFixed(2),
      blockCount: stats.blockCount,
      totalEmptyBlock: totalEmptyBlock,
      totalEmptyBlockRatio: totalEmptyBlockRatio,
      pools: poolsStats,
    };
  }
}
