import { ChangeDetectionStrategy, Component, Input, NgZone, OnInit } from '@angular/core';
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
import { chartColors, poolsColor } from 'src/app/app.constants';

@Component({
  selector: 'app-pool-ranking',
  templateUrl: './pool-ranking.component.html',
  styleUrls: ['./pool-ranking.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoolRankingComponent implements OnInit {
  @Input() widget: boolean = false;

  poolsWindowPreference: string;
  radioGroupForm: FormGroup;

  isLoading = true;
  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
    width: 'auto',
    height: 'auto',
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
    private zone: NgZone,
  ) {
  }

  ngOnInit(): void {
    if (this.widget) {
      this.poolsWindowPreference = '1w';
    } else {
      this.seoService.setTitle($localize`:@@mining.mining-pools:Mining Pools`);
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
          data['minersLuck'] = (100 * (data.blockCount / 1008)).toFixed(2); // luck 1w
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
    const poolShareThreshold = this.isMobile() ? 2 : 1; // Do not draw pools which hashrate share is lower than that
    const data: object[] = [];
    let totalShareOther = 0;
    let totalBlockOther = 0;
    let totalEstimatedHashrateOther = 0;

    let edgeDistance: any = '20%';
    if (this.isMobile() && this.widget) {
      edgeDistance = 0;
    } else if (this.isMobile() && !this.widget || this.widget) {
      edgeDistance = 10;
    }

    miningStats.pools.forEach((pool) => {
      if (parseFloat(pool.share) < poolShareThreshold) {
        totalShareOther += parseFloat(pool.share);
        totalBlockOther += pool.blockCount;
        totalEstimatedHashrateOther += pool.lastEstimatedHashrate;
        return;
      }
      data.push({
        itemStyle: {
          color: poolsColor[pool.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()],
        },
        value: pool.share,
        name: pool.name + ((this.isMobile() || this.widget) ? `` : ` (${pool.share}%)`),
        label: {
          overflow: 'none',
          color: '#b1b1b1',
          alignTo: 'edge',
          edgeDistance: edgeDistance,
        },
        tooltip: {
          show: !this.isMobile() || !this.widget,
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
        data: pool.slug,
      } as PieSeriesOption);
    });

    // 'Other'
    data.push({
      itemStyle: {
        color: 'grey',
      },
      value: totalShareOther,
      name: 'Other' + (this.isMobile() ? `` : ` (${totalShareOther.toFixed(2)}%)`),
      label: {
        overflow: 'none',
        color: '#b1b1b1',
        alignTo: 'edge',
        edgeDistance: edgeDistance
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
            return `<b style="color: white">${'Other'} (${totalShareOther.toFixed(2)}%)</b><br>` +
              totalEstimatedHashrateOther.toString() + ' PH/s' +
              `<br>` + totalBlockOther.toString() + ` blocks`;
          } else {
            return `<b style="color: white">${'Other'} (${totalShareOther.toFixed(2)}%)</b><br>` +
              totalBlockOther.toString() + ` blocks`;
          }
        }
      },
      data: 9999 as any,
    } as PieSeriesOption);

    return data;
  }

  prepareChartOptions(miningStats) {
    let network = this.stateService.network;
    if (network === '') {
      network = 'bitcoin';
    }
    network = network.charAt(0).toUpperCase() + network.slice(1);

    let radius: any[] = ['20%', '80%'];
    let top: number = 0; let height = undefined;
    if (this.isMobile() && this.widget) {
      top = -30;
      height = 270;
      radius = ['10%', '50%'];
    } else if (this.isMobile() && !this.widget) {
      top = -40;
      height = 300;
      radius = ['10%', '50%'];
    } else if (this.widget) {
      radius = ['15%', '60%'];
      top = -20;
      height = 330;
    } else {
      top = 0;
    }

    this.chartOptions = {
      animation: false,
      color: chartColors,
      tooltip: {
        trigger: 'item',
        textStyle: {
          align: 'left',
        }
      },
      series: [
        {
          minShowLabelAngle: 3.6,
          top: top,
          height: height,
          name: 'Mining pool',
          type: 'pie',
          radius: radius,
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
            borderRadius: 1,
            borderWidth: 1,
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
    };
  }

  onChartInit(ec) {
    if (this.chartInstance !== undefined) {
      return;
    }

    this.chartInstance = ec;
    this.chartInstance.on('click', (e) => {
      if (e.data.data === 9999) { // "Other"
        return;
      }
      this.zone.run(() => {
        this.router.navigate(['/mining/pool/', e.data.data]);
      });
    });
  }

  /**
   * Default mining stats if something goes wrong
   */
  getEmptyMiningStat(): MiningStats {
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

