import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { merge, Observable, ObservableInput, of } from 'rxjs';
import { map, share, switchMap, tap } from 'rxjs/operators';
import { PoolsStats } from 'src/app/interfaces/node-api.interface';
import { StorageService } from 'src/app/services/storage.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-pool-ranking',
  templateUrl: './pool-ranking.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoolRankingComponent implements OnInit {
  pools$: Observable<object>

  radioGroupForm: FormGroup;
  poolsWindowPreference: string;

  constructor(
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private storageService: StorageService,
  ) { }

  ngOnInit(): void {
    this.poolsWindowPreference = this.storageService.getValue('poolsWindowPreference') ? this.storageService.getValue('poolsWindowPreference').trim() : '2h';
    this.radioGroupForm = this.formBuilder.group({
      dateSpan: this.poolsWindowPreference
    });

    // Setup datespan triggers
    this.route.fragment.subscribe((fragment) => {
      if (['1d', '3d', '1w', '1m', '3m', '6m', '1y', '2y', '3y', 'all'].indexOf(fragment) > -1) {
        this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
      }
    });
    merge(of(''), this.radioGroupForm.controls.dateSpan.valueChanges)
      .pipe(switchMap(() => this.onDateSpanChanged()))
      .subscribe((pools: any) => {
        console.log(pools);
      });

    // Fetch initial mining pool data
    this.onDateSpanChanged();
  }

  ngOnChanges() {
  }

  rendered() {
  }

  savePoolsPreference() {
    this.storageService.setValue('poolsWindowPreference', this.radioGroupForm.controls.dateSpan.value);
    this.poolsWindowPreference = this.radioGroupForm.controls.dateSpan.value;
  }

  onDateSpanChanged(): ObservableInput<any> {
    let interval: string;
    console.log(this.poolsWindowPreference);
    switch (this.poolsWindowPreference) {
      case '1d': interval = '1 DAY'; break;
      case '3d': interval = '3 DAY'; break;
      case '1w': interval = '1 WEEK'; break;
      case '1m': interval = '1 MONTH'; break;
      case '3m': interval = '3 MONTH'; break;
      case '6m': interval = '6 MONTH'; break;
      case '1y': interval = '1 YEAR'; break;
      case '2y': interval = '2 YEAR'; break;
      case '3y': interval = '3 YEAR'; break;
      case 'all': interval = '1000 YEAR'; break;
    }
    this.pools$ = this.apiService.listPools$(interval).pipe(map(res => this.computeMiningStats(res)));
    return this.pools$;
  }

  computeMiningStats(stats: PoolsStats) {
    const totalEmptyBlock = Object.values(stats.poolsStats).reduce((prev, cur) => {
      return prev + cur.emptyBlocks;
    }, 0);
    const totalEmptyBlockRatio = (totalEmptyBlock / stats.blockCount * 100).toFixed(2);
    const poolsStats = stats.poolsStats.map((poolStat) => {
      return {
        share: (poolStat.blockCount / stats.blockCount * 100).toFixed(2),
        lastEstimatedHashrate: (poolStat.blockCount / stats.blockCount * stats.lastEstimatedHashrate / Math.pow(10, 15)).toFixed(2),
        emptyBlockRatio: (poolStat.emptyBlocks / poolStat.blockCount * 100).toFixed(2),
        ...poolStat
      }
    });

    return {
      lastEstimatedHashrate: (stats.lastEstimatedHashrate / Math.pow(10, 15)).toFixed(2),
      blockCount: stats.blockCount,
      totalEmptyBlock: totalEmptyBlock,
      totalEmptyBlockRatio: totalEmptyBlockRatio,
      poolsStats: poolsStats,
    }
  }
}

