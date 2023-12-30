import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { echarts, EChartsOption } from '../../graphs/echarts';
import { BehaviorSubject, Observable, of, timer } from 'rxjs';
import { catchError, distinctUntilChanged, map, share, switchMap, tap } from 'rxjs/operators';
import { BlockExtended, PoolStat } from '../../interfaces/node-api.interface';
import { ApiService } from '../../services/api.service';
import { StateService } from '../../services/state.service';
import { selectPowerOfTen } from '../../bitcoin.utils';
import { formatNumber } from '@angular/common';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-pool',
  templateUrl: './pool.component.html',
  styleUrls: ['./pool.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PoolComponent implements OnInit {
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  gfg = true;

  formatNumber = formatNumber;
  poolStats$: Observable<PoolStat>;
  blocks$: Observable<BlockExtended[]>;
  isLoading = true;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  blocks: BlockExtended[] = [];
  slug: string = undefined;

  auditAvailable = false;

  loadMoreSubject: BehaviorSubject<number> = new BehaviorSubject(this.blocks[this.blocks.length - 1]?.height);

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private apiService: ApiService,
    private route: ActivatedRoute,
    public stateService: StateService,
    private seoService: SeoService,
  ) {
    this.auditAvailable = this.stateService.env.AUDIT;
  }

  ngOnInit(): void {
    this.poolStats$ = this.route.params.pipe(map((params) => params.slug))
      .pipe(
        switchMap((slug: any) => {
          this.isLoading = true;
          this.slug = slug;
          return this.apiService.getPoolHashrate$(this.slug)
            .pipe(
              switchMap((data) => {
                this.isLoading = false;
                this.prepareChartOptions(data.map(val => [val.timestamp * 1000, val.avgHashrate]));
                return [slug];
              }),
              catchError(() => {
                this.isLoading = false;
                this.seoService.logSoft404();
                return of([slug]);
              })
            );
        }),
        switchMap((slug) => {
          return this.apiService.getPoolStats$(slug).pipe(
            catchError(() => {
              this.isLoading = false;
              this.seoService.logSoft404();
              return of(null);
            })
          );
        }),
        tap(() => {
          this.loadMoreSubject.next(this.blocks[0]?.height);
        }),
        map((poolStats) => {
          this.seoService.setTitle(poolStats.pool.name);
          this.seoService.setDescription($localize`:@@meta.description.mining.pool:See mining pool stats for ${poolStats.pool.name}\: most recent mined blocks, hashrate over time, total block reward to date, known coinbase addresses, and more.`);
          let regexes = '"';
          for (const regex of poolStats.pool.regexes) {
            regexes += regex + '", "';
          }
          poolStats.pool.regexes = regexes.slice(0, -3);

          return Object.assign({
            logo: `/resources/mining-pools/` + poolStats.pool.slug + '.svg'
          }, poolStats);
        })
      );

    this.blocks$ = this.loadMoreSubject
      .pipe(
        distinctUntilChanged(),
        switchMap((flag) => {
          if (this.slug === undefined) {
            return [];
          }
          return this.apiService.getPoolBlocks$(this.slug, this.blocks[this.blocks.length - 1]?.height);
        }),
        tap((newBlocks) => {
          this.blocks = this.blocks.concat(newBlocks);
        }),
        map(() => this.blocks),
        share(),
      );
  }

  prepareChartOptions(data) {
    let title: object;
    if (data.length <= 1) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: $localize`Not enough data yet`,
        left: 'center',
        top: 'center'
      };
    }

    this.chartOptions = {
      title: title,
      animation: false,
      color: [
        new echarts.graphic.LinearGradient(0, 0, 0, 0.65, [
          { offset: 0, color: '#F4511E' },
          { offset: 0.25, color: '#FB8C00' },
          { offset: 0.5, color: '#FFB300' },
          { offset: 0.75, color: '#FDD835' },
          { offset: 1, color: '#7CB342' }
        ]),
        '#D81B60',
      ],
      grid: {
        right: this.right,
        left: this.left,
        bottom: 60,
      },
      tooltip: {
        show: !this.isMobile(),
        trigger: 'axis',
        axisPointer: {
          type: 'line'
        },
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: '#b1b1b1',
          align: 'left',
        },
        borderColor: '#000',
        formatter: function (ticks: any[]) {
          let hashratePowerOfTen: any = selectPowerOfTen(1);
          let hashrate = ticks[0].data[1];

          hashratePowerOfTen = selectPowerOfTen(ticks[0].data[1], 10);
          hashrate = ticks[0].data[1] / hashratePowerOfTen.divider;

          return `
            <b style="color: white; margin-left: 18px">${ticks[0].axisValueLabel}</b><br>
            <span>${ticks[0].marker} ${ticks[0].seriesName}: ${formatNumber(hashrate, this.locale, '1.0-0')} ${hashratePowerOfTen.unit}H/s</span><br>
          `;
        }.bind(this)
      },
      xAxis: data.length <= 1 ? undefined : {
        type: 'time',
        splitNumber: (this.isMobile()) ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      yAxis: data.length <= 1 ? undefined : [
        {
          min: (value) => {
            return value.min * 0.9;
          },
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              const selectedPowerOfTen: any = selectPowerOfTen(val);
              const newVal = Math.round(val / selectedPowerOfTen.divider);
              return `${newVal} ${selectedPowerOfTen.unit}H/s`
            }
          },
          splitLine: {
            show: false,
          }
        },
      ],
      series: data.length <= 1 ? undefined : [
        {
          zlevel: 0,
          name: 'Hashrate',
          showSymbol: false,
          symbol: 'none',
          data: data,
          type: 'line',
          lineStyle: {
            width: 2,
          },
        },
      ],
      dataZoom: data.length <= 1 ? undefined : [{
        type: 'inside',
        realtime: true,
        zoomLock: true,
        maxSpan: 100,
        minSpan: 10,
        moveOnMouseMove: false,
      }, {
        fillerColor: '#aaaaff15',
        borderColor: '#ffffff88',
        showDetail: false,
        show: true,
        type: 'slider',
        brushSelect: false,
        realtime: true,
        bottom: 0,
        left: 20,
        right: 15,
        selectedDataBackground: {
          lineStyle: {
            color: '#fff',
            opacity: 0.45,
          },
          areaStyle: {
            opacity: 0,
          },
        },
      }],
    };
  }

  isMobile() {
    return (window.innerWidth <= 767.98);
  }

  loadMore() {
    this.loadMoreSubject.next(this.blocks[this.blocks.length - 1]?.height);
  }

  trackByBlock(index: number, block: BlockExtended) {
    return block.height;
  }
}
