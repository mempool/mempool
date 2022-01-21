import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { EChartsOption } from 'echarts';
import { combineLatest, Observable, of } from 'rxjs';
import { catchError, map, skip, startWith, switchMap, tap } from 'rxjs/operators';
import { SinglePoolStats } from 'src/app/interfaces/node-api.interface';
import { StorageService } from '../..//services/storage.service';
import { MiningService, MiningStats } from '../../services/mining.service';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-pool-ranking',
  templateUrl: './pool-ranking.component.html',
  styleUrls: ['./pool-ranking.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 38%;
      left: calc(50% - 15px);
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
        map(data => {
          data.pools = data.pools.map((pool: SinglePoolStats) => this.formatPoolUI(pool));
          return data;
        }),
        tap(data => {
          this.isLoading = false;
          this.prepareChartOptions(data);
        })
      );
  }

  ngOnDestroy(): void {
  }

  formatPoolUI(pool: SinglePoolStats) {
    pool['blockText'] = pool.blockCount.toString() + ` (${pool.share}%)`;
    return pool;
  }

  isMobile() {
    return (window.innerWidth <= 767.98);
  }

  generatePoolsChartSerieData(miningStats) {
    const poolShareThreshold = this.isMobile() ? 1 : 0.5; // Do not draw pools which hashrate share is lower than that
    const data: object[] = [];

    miningStats.pools.forEach((pool) => {
      if (parseFloat(pool.share) < poolShareThreshold) {
        return;
      }
      data.push({
        value: pool.share,
        name: pool.name + (this.isMobile() ? `` : ` (${pool.share}%)`),
        label: {
          color: '#FFFFFF',
          overflow: 'break',
        },
        tooltip: {
          backgroundColor: "#282d47",
          textStyle: {
            color: "#FFFFFF",
          },
          formatter: () => {
            if (this.poolsWindowPreference === '1d') {
              return `<u><b>${pool.name} (${pool.share}%)</b></u><br>` +
                pool.lastEstimatedHashrate.toString() + ' PH/s' +
                `<br>` + pool.blockCount.toString() + ` blocks`;
            } else {
              return `<u><b>${pool.name} (${pool.share}%)</b></u><br>` +
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
          color: '#FFF',
        },
        subtextStyle: {
          color: '#CCC',
          fontStyle: 'italic',
        }
      },
      tooltip: {
        trigger: 'item'
      },
      series: [
        {
          top: this.isMobile() ? '5%' : '20%',
          name: 'Mining pool',
          type: 'pie',
          radius: this.isMobile() ? ['10%', '50%'] : ['20%', '80%'],
          data: this.generatePoolsChartSerieData(miningStats),
          labelLine: {
            lineStyle: {
              width: 2,
            },
          },
          label: {
            fontSize: 14,
          },
          itemStyle: {
            borderRadius: 2,
            borderWidth: 2,
            borderColor: '#000',
          },
          emphasis: {
            itemStyle: {
              borderWidth: 2,
              borderColor: '#FFF',
              borderRadius: 2,
              shadowBlur: 80,
              shadowColor: 'rgba(255, 255, 255, 0.75)',
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

