import { ChangeDetectionStrategy, Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { echarts, EChartsOption } from '@app/graphs/echarts';
import { Observable, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { PoolStat } from '@interfaces/node-api.interface';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { formatNumber } from '@angular/common';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';

@Component({
  selector: 'app-pool-preview',
  templateUrl: './pool-preview.component.html',
  styleUrls: ['./pool-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PoolPreviewComponent implements OnInit {
  formatNumber = formatNumber;
  poolStats$: Observable<PoolStat>;
  isLoading = true;
  imageLoaded = false;
  lastImgSrc: string = '';

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  slug: string = undefined;

  ogSession: number;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private apiService: ApiService,
    private route: ActivatedRoute,
    public stateService: StateService,
    private seoService: SeoService,
    private openGraphService: OpenGraphService,
  ) {
  }

  ngOnInit(): void {
    this.poolStats$ = this.route.params.pipe(map((params) => params.slug))
      .pipe(
        switchMap((slug: any) => {
          this.isLoading = true;
          this.imageLoaded = false;
          this.slug = slug;
          this.ogSession = this.openGraphService.waitFor('pool-hash-' + this.slug);
          this.ogSession = this.openGraphService.waitFor('pool-stats-' + this.slug);
          this.ogSession = this.openGraphService.waitFor('pool-chart-' + this.slug);
          this.ogSession = this.openGraphService.waitFor('pool-img-' + this.slug);
          return this.apiService.getPoolHashrate$(this.slug)
            .pipe(
              switchMap((data) => {
                this.isLoading = false;
                this.prepareChartOptions(data.map(val => [val.timestamp * 1000, val.avgHashrate]));
                this.openGraphService.waitOver({ event: 'pool-hash-' + this.slug, sessionId: this.ogSession });
                return [slug];
              }),
              catchError(() => {
                this.isLoading = false;
                this.seoService.logSoft404();
                this.openGraphService.fail({ event: 'pool-hash-' + this.slug, sessionId: this.ogSession });
                return of([slug]);
              })
            );
        }),
        switchMap((slug) => {
          return this.apiService.getPoolStats$(slug).pipe(
            catchError(() => {
              this.isLoading = false;
              this.seoService.logSoft404();
              this.openGraphService.fail({ event: 'pool-stats-' + this.slug, sessionId: this.ogSession });
              return of(null);
            })
          );
        }),
        map((poolStats) => {
          if (poolStats == null) {
            return null;
          }

          this.seoService.setTitle(poolStats.pool.name);
          this.seoService.setDescription($localize`:@@meta.description.mining.pool:See mining pool stats for ${poolStats.pool.name}\: most recent mined blocks, hashrate over time, total block reward to date, known coinbase addresses, and more.`);
          let regexes = '"';
          for (const regex of poolStats.pool.regexes) {
            regexes += regex + '", "';
          }
          poolStats.pool.regexes = regexes.slice(0, -3);

          this.openGraphService.waitOver({ event: 'pool-stats-' + this.slug, sessionId: this.ogSession });

          const logoSrc = `/resources/mining-pools/` + poolStats.pool.slug + '.svg';
          if (logoSrc === this.lastImgSrc) {
            this.openGraphService.waitOver({ event: 'pool-img-' + this.slug, sessionId: this.ogSession });
          }
          this.lastImgSrc = logoSrc;
          return Object.assign({
            logo: logoSrc
          }, poolStats);
        }),
        catchError(() => {
          this.isLoading = false;
          this.openGraphService.fail({ event: 'pool-stats-' + this.slug, sessionId: this.ogSession });
          return of(null);
        })
      );
  }

  prepareChartOptions(data) {
    let title: object;
    if (data.length === 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: $localize`:@@23555386d8af1ff73f297e89dd4af3f4689fb9dd:Indexing blocks`,
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
        left: 15,
        right: 15,
        bottom: 15,
        top: 15,
        show: false,
      },
      xAxis: data.length === 0 ? undefined : {
        type: 'time',
        show: false,
      },
      yAxis: data.length === 0 ? undefined : [
        {
          type: 'value',
          show: false,
        },
      ],
      series: data.length === 0 ? undefined : [
        {
          zlevel: 0,
          name: 'Hashrate',
          showSymbol: false,
          symbol: 'none',
          data: data,
          type: 'line',
          lineStyle: {
            width: 4,
          },
        },
      ],
    };
  }

  onChartReady(): void {
    this.openGraphService.waitOver({ event: 'pool-chart-' + this.slug, sessionId: this.ogSession });
  }

  onImageLoad(): void {
    this.imageLoaded = true;
    this.openGraphService.waitOver({ event: 'pool-img-' + this.slug, sessionId: this.ogSession });
  }

  onImageFail(): void {
    this.imageLoaded = false;
    this.openGraphService.waitOver({ event: 'pool-img-' + this.slug, sessionId: this.ogSession });
  }
}
