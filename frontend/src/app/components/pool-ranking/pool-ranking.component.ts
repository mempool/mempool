import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { EChartsOption, PieSeriesOption } from 'echarts';
import { combineLatest, Observable, of } from 'rxjs';
import { catchError, map, share, skip, startWith, switchMap, tap } from 'rxjs/operators';
import { SinglePoolStats } from 'src/app/interfaces/node-api.interface';
import { SeoService } from 'src/app/services/seo.service';
import { StorageService } from '../..//services/storage.service';
import { MiningService, MiningStats } from '../../services/mining.service';
import { StateService } from '../../services/state.service';
import { chartColors } from 'src/app/app.constants';

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
export class PoolRankingComponent implements OnInit {
  @Input() widget: boolean = false;

  poolsWindowPreference: string;
  radioGroupForm: FormGroup;

  isLoading = true;
  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg'
  };
  chartInstance: any = undefined;

  miningStatsObservable$: Observable<MiningStats>;

  constructor(
    private stateService: StateService,
    private storageService: StorageService,
    private formBuilder: FormBuilder,
    private miningService: MiningService,
    private seoService: SeoService,
    private router: Router,
  ) {
    this.seoService.setTitle($localize`:@@mining.mining-pools:Mining Pools`);
  }

  ngOnInit(): void {
    if (this.widget) {
      this.poolsWindowPreference = '1w';
    } else {
      this.poolsWindowPreference = this.storageService.getValue('poolsWindowPreference') ? this.storageService.getValue('poolsWindowPreference') : '1w';    
    }
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.poolsWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.poolsWindowPreference);

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
            if (!this.widget) {
              this.storageService.setValue('poolsWindowPreference', value);
            }
            this.poolsWindowPreference = value;
          })
        )
    ])
      // ...then refresh the mining stats
      .pipe(
        switchMap(() => {
          this.isLoading = true;
          return this.miningService.getMiningStats(this.poolsWindowPreference)
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
        }),
        share()
      );
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
          color: '#b1b1b1',
          overflow: 'break',
        },
        tooltip: {
          backgroundColor: 'rgba(17, 19, 31, 1)',
          borderRadius: 4,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
          textStyle: {
            color: '#b1b1b1',
          },
          borderColor: '#000',
          formatter: () => {
            if (this.poolsWindowPreference === '24h') {
              return `<b style="color: white">${pool.name} (${pool.share}%)</b><br>` +
                pool.lastEstimatedHashrate.toString() + ' PH/s' +
                `<br>` + pool.blockCount.toString() + ` blocks`;
            } else {
              return `<b style="color: white">${pool.name} (${pool.share}%)</b><br>` +
                pool.blockCount.toString() + ` blocks`;
            }
          }
        },
        data: pool.poolId,
      } as PieSeriesOption);
    });
    return data;
  }

  prepareChartOptions(miningStats) {
    let network = this.stateService.network;
    if (network === '') {
      network = 'bitcoin';
    }
    network = network.charAt(0).toUpperCase() + network.slice(1);

    this.chartOptions = {
      title: {
        text: this.widget ? '' : $localize`:@@mining.pool-chart-title:${network}:NETWORK: mining pools share`,
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
          top: this.widget ? '0%' : (this.isMobile() ? '5%' : '10%'),
          bottom: this.widget ? '0%' : (this.isMobile() ? '0%' : '5%'),
          name: 'Mining pool',
          type: 'pie',
          radius: this.widget ? ['20%', '60%'] : (this.isMobile() ? ['10%', '50%'] : ['20%', '70%']),
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
              shadowBlur: 40,
              shadowColor: 'rgba(0, 0, 0, 0.75)',
            },
            labelLine: {
              lineStyle: {
                width: 3,
              }
            }
          }
        }
      ],
      color: chartColors
    };
  }

  onChartInit(ec) {
    if (this.chartInstance !== undefined) {
      return;
    }

    this.chartInstance = ec;
    this.chartInstance.on('click', (e) => {
      this.router.navigate(['/mining/pool/', e.data.data]);
    });
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
      availableTimespanDay: 0,
      miningUnits: {
        hashrateDivider: 1,
        hashrateUnit: '',
      },
    };
  }
}

