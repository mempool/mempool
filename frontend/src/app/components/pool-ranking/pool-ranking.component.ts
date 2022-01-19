import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { EChartsOption } from 'echarts';
import { BehaviorSubject, Subscription } from 'rxjs';
import { StateService } from 'src/app/services/state.service';
import { StorageService } from 'src/app/services/storage.service';
import { MiningService, MiningStats } from '../../services/mining.service';

@Component({
  selector: 'app-pool-ranking',
  templateUrl: './pool-ranking.component.html',
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 52%;
      left: calc(50% - 16px);
      z-index: 100;
    }
  `],
})
export class PoolRankingComponent implements OnInit, OnDestroy {
  poolsWindowPreference: string;
  radioGroupForm: FormGroup;

  miningStats!: MiningStats;
  miningStatsEmitter$ = new BehaviorSubject<MiningStats>(this.miningStats);
  blocksSubscription: Subscription;
  miningSubscription: Subscription;

  isLoading = true;
  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg'
  };

  constructor(
    private stateService: StateService,
    private storageService: StorageService,
    private formBuilder: FormBuilder,
    private miningService: MiningService,
  ) {
    this.poolsWindowPreference = this.storageService.getValue('poolsWindowPreference') ? this.storageService.getValue('poolsWindowPreference').trim() : '2h';

    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.poolsWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.poolsWindowPreference);
  }

  ngOnInit(): void {
    this.refreshMiningStats();
    this.watchBlocks();
  }

  ngOnDestroy(): void {
    this.blocksSubscription.unsubscribe();
    this.miningSubscription.unsubscribe();      
  }

  refreshMiningStats() {
    this.miningSubscription = this.miningService.getMiningStats(this.getSQLInterval(this.poolsWindowPreference))
    .subscribe(async data => {
      this.miningStats = data;
      this.miningStatsEmitter$.next(this.miningStats);
      this.prepareChartOptions();
      this.isLoading = false;
    });

    return this.miningSubscription;
  }

  watchBlocks() {
    this.blocksSubscription = this.stateService.blocks$
      .subscribe(() => {
        if (!this.miningStats) {
          return;
        }
        this.refreshMiningStats();
      });
  }

  onChangeWindowPreference(e) {
    this.storageService.setValue('poolsWindowPreference', e.target.value);
    this.poolsWindowPreference = e.target.value;
    this.isLoading = true;
    this.refreshMiningStats();
  }

  generatePoolsChartSerieData() {
    const poolShareThreshold = 0.5; // Do not draw pools which hashrate share is lower than that
    const data: object[] = [];

    this.miningStats.pools.forEach((pool) => {
      if (parseFloat(pool.share) < poolShareThreshold) {
        return;
      }
      data.push({
        value: pool.share,
        name: pool.name,
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

  prepareChartOptions() {
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
          data: this.generatePoolsChartSerieData(),
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

}

