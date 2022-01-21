import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { EChartsOption } from 'echarts';
import { combineLatest, Observable, of } from 'rxjs';
import { catchError, skip, startWith, switchMap, tap } from 'rxjs/operators';
import { StorageService } from '../..//services/storage.service';
import { MiningService, MiningStats } from '../../services/mining.service';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-pool-ranking',
  templateUrl: './pool-ranking.component.html',
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 16px);
      z-index: 100;
    }
  `],
})
export class PoolRankingComponent implements OnInit, OnDestroy {
  poolsWindowPreference: string;
  radioGroupForm: FormGroup;

  isLoading = true;
  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg'
  };

  miningStatsObservable$: Observable<MiningStats>;

  constructor(
    private stateService: StateService,
    private storageService: StorageService,
    private formBuilder: FormBuilder,
    private miningService: MiningService,
  ) {
    this.poolsWindowPreference = this.storageService.getValue('poolsWindowPreference') ? this.storageService.getValue('poolsWindowPreference') : '1d';
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.poolsWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.poolsWindowPreference);
  }

  ngOnInit(): void {
    // When...
    this.miningStatsObservable$ = combineLatest([
      // ...a new block is mined
      this.stateService.blocks$
        .pipe(
          // (we always receives some blocks at start so only trigger for the last one)
          skip(this.stateService.env.MEMPOOL_BLOCKS_AMOUNT - 1),
        ),
      // ...or we change the timespan
      this.radioGroupForm.get('dateSpan').valueChanges
        .pipe(
          startWith(this.poolsWindowPreference), // (trigger when the page loads)
          tap((value) => {
            this.storageService.setValue('poolsWindowPreference', value);
            this.poolsWindowPreference = value;
          })
        )
    ])
      // ...then refresh the mining stats
      .pipe(
        switchMap(() => {
          this.isLoading = true;
          return this.miningService.getMiningStats(this.getSQLInterval(this.poolsWindowPreference))
            .pipe(
              catchError((e) => of(this.getEmptyMiningStat()))
            );
        }),
        tap(data => {
          this.isLoading = false;
          this.prepareChartOptions(data);
        })
      );
  }

  ngOnDestroy(): void {
  }

  generatePoolsChartSerieData(miningStats) {
    const poolShareThreshold = 0.5; // Do not draw pools which hashrate share is lower than that
    const data: object[] = [];

    miningStats.pools.forEach((pool) => {
      if (parseFloat(pool.share) < poolShareThreshold) {
        return;
      }
      data.push({
        value: pool.share,
        name: pool.name + ` (${pool.share}%)`,
        label: { color: '#FFFFFF' },
        tooltip: {
          formatter: () => {
            if (this.poolsWindowPreference === '1d') {
              return `<u><b>${pool.name}</b></u><br>` +
                pool.lastEstimatedHashrate.toString() + ' PH/s (' + pool.share + `%)
                <br>(` + pool.blockCount.toString() + ` blocks)`;
            } else {
              return `<u><b>${pool.name}</b></u><br>` +
                pool.blockCount.toString() + ` blocks`;
            }
          }
        }
      });
    });
    return data;
  }

  prepareChartOptions(miningStats) {
    this.chartOptions = {
      title: {
        text: (this.poolsWindowPreference === '1d') ? 'Hashrate distribution' : 'Block distribution',
        subtext: (this.poolsWindowPreference === '1d') ? 'Estimated from the # of blocks mined' : null,
        left: 'center',
        textStyle: {
          color: '#FFFFFF',
        },
        subtextStyle: {
          color: '#CCCCCC',
          fontStyle: 'italic',
        }
      },
      tooltip: {
        trigger: 'item'
      },
      legend: (window.innerWidth <= 767.98) ? {
        bottom: '0%',
        left: 'center',
        textStyle: {
          color: '#FFF'
        }
      } : null,
      series: [
        {
          top: '5%',
          name: 'Mining pool',
          type: 'pie',
          radius: ['30%', '70%'],
          data: this.generatePoolsChartSerieData(miningStats),
          labelLine: {
            lineStyle: {
              width: 2,
            },
          },
          label: {
            show: (window.innerWidth > 767.98),
            fontSize: 14,
          },
          itemStyle: {
            borderRadius: 5,
            borderWidth: 2,
            borderColor: '#000',
          },
          emphasis: {
            itemStyle: {
              borderWidth: 5,
              borderColor: '#000',
              borderRadius: 20,
              shadowBlur: 40,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.75)'
            },
            labelLine: {
              lineStyle: {
                width: 3,
              }
            }
          }
        }
      ]
    };
  }

  getSQLInterval(uiInterval: string) {
    switch (uiInterval) {
      case '1d': return '1 DAY';
      case '3d': return '3 DAY';
      case '1w': return '1 WEEK';
      case '1m': return '1 MONTH';
      case '3m': return '3 MONTH';
      case '6m': return '6 MONTH';
      case '1y': return '1 YEAR';
      case '2y': return '2 YEAR';
      case '3y': return '3 YEAR';
      default: return '1000 YEAR';
    }
  }

  /**
   * Default mining stats if something goes wrong
   */
  getEmptyMiningStat() {
    return {
      lastEstimatedHashrate: 'Error',
      blockCount: 0,
      totalEmptyBlock: 0,
      totalEmptyBlockRatio: '',
      pools: [],
      miningUnits: {
        hashrateDivider: 1,
        hashrateUnit: '',
      },
    };
  }
}

