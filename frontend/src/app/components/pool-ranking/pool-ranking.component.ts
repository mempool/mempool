import { Component, OnInit, ChangeDetectionStrategy, OnChanges } from '@angular/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { EChartsOption } from 'echarts';
import { BehaviorSubject, merge, of } from 'rxjs';
import { skip } from 'rxjs/operators';
import { MiningStats } from 'src/app/interfaces/node-api.interface';
import { StorageService } from 'src/app/services/storage.service';
import { MiningService } from '../../services/mining.service';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoolRankingComponent implements OnInit, OnChanges {
  poolsWindowPreference: string;
  radioGroupForm: FormGroup;

  miningStats!: MiningStats;
  miningStatsEmitter$ = new BehaviorSubject<MiningStats>(this.miningStats);

  isLoading = true;
  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg'
  };

  constructor(
    private storageService: StorageService,
    private formBuilder: FormBuilder,
    private miningService: MiningService,
  ) {
    this.poolsWindowPreference = this.storageService.getValue('poolsWindowPreference') ? this.storageService.getValue('poolsWindowPreference').trim() : '2h';

    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.poolsWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.poolsWindowPreference);

    this.refreshMiningStats();
}

  ngOnInit() {
  }

  sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

  refreshMiningStats() {
    return this.miningService.getMiningStats(this.getSQLInterval(this.poolsWindowPreference))
      .subscribe(async data => {
        this.miningStats = data;
        this.miningStatsEmitter$.next(this.miningStats);
        this.prepareChartOptions();
        this.isLoading = false;
      });
  }

  ngOnChanges() {
  }

  onChangeWindowPreference(e) {
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
        value: pool.lastEstimatedHashrate,
        name: pool.name,
        label: { color: '#FFFFFF' },
        tooltip: {
          formatter: () => {
            return `<u><b>${pool.name}</b></u><br>` +
              pool.lastEstimatedHashrate.toString() + ' PH/s (' + pool.share + `%)
              <br>(` + pool.blockCount.toString() + ` blocks)`;
          }
        }
      });
    });
    return data;
  }

  prepareChartOptions() {
    this.chartOptions = {
      title: {
        text: 'Hashrate distribution',
        subtext: 'Estimated from the # of blocks mined',
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
      series: [
        {
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

