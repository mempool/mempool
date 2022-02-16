import { Component, OnInit } from '@angular/core';
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
    this.poolsWindowPreference = this.storageService.getValue('poolsWindowPreference') ? this.storageService.getValue('poolsWindowPreference') : '1w';
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
      data.push(<PieSeriesOption>{
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
            if (this.poolsWindowPreference === '24h') {
              return `<u><b>${pool.name} (${pool.share}%)</b></u><br>` +
                pool.lastEstimatedHashrate.toString() + ' PH/s' +
                `<br>` + pool.blockCount.toString() + ` blocks`;
            } else {
              return `<u><b>${pool.name} (${pool.share}%)</b></u><br>` +
                pool.blockCount.toString() + ` blocks`;
            }
          }
        },
        data: pool.poolId,
      });
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
        text: $localize`:@@mining.pool-chart-title:${network}:NETWORK: mining pools share`,
        subtext: $localize`:@@mining.pool-chart-sub-title:Estimated from the # of blocks mined`,
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

  onChartInit(ec) {
    if (this.chartInstance !== undefined) {
      return;
    }

    this.chartInstance = ec;
    this.chartInstance.on('click', (e) => {
      this.router.navigate(['/mining/pool/', e.data.data]); 
    })
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

