import { ChangeDetectionStrategy, Component, Input, NgZone, OnInit, HostBinding } from '@angular/core';
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
import { RelativeUrlPipe } from 'src/app/shared/pipes/relative-url/relative-url.pipe';
import { download } from 'src/app/shared/graphs.utils';

@Component({
  selector: 'app-pool-ranking',
  templateUrl: './pool-ranking.component.html',
  styleUrls: ['./pool-ranking.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoolRankingComponent implements OnInit {
  @Input() widget = false;

  miningWindowPreference: string;
  radioGroupForm: FormGroup;

  isLoading = true;
  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };
  timespan = '';
  chartInstance: any = undefined;

  @HostBinding('attr.dir') dir = 'ltr';

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
      this.miningWindowPreference = '1w';
    } else {
      this.seoService.setTitle($localize`:@@mining.mining-pools:Mining Pools`);
      this.miningWindowPreference = this.miningService.getDefaultTimespan('24h');
    }
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

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
          startWith(this.miningWindowPreference), // (trigger when the page loads)
          tap((value) => {
            this.timespan = value;
            if (!this.widget) {
              this.storageService.setValue('miningWindowPreference', value);
            }
            this.miningWindowPreference = value;
          })
        )
    ])
      // ...then refresh the mining stats
      .pipe(
        switchMap(() => {
          this.isLoading = true;
          return this.miningService.getMiningStats(this.miningWindowPreference)
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
            if (this.miningWindowPreference === '24h') {
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
          if (this.miningWindowPreference === '24h') {
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
    this.chartOptions = {
      backgroundColor: '#11131f',
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
          zlevel: 0,
          minShowLabelAngle: 3.6,
          name: 'Mining pool',
          type: 'pie',
          radius: ['20%', '80%'],
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
        const url = new RelativeUrlPipe(this.stateService).transform(`/mining/pool/${e.data.data}`);
        this.router.navigate([url]);
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
      totalBlockCount: 0,
      miningUnits: {
        hashrateDivider: 1,
        hashrateUnit: '',
      },
    };
  }

  onSaveChart() {
    const now = new Date();
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `pools-ranking-${this.timespan}-${now.getTime() / 1000}`);
  }
}

