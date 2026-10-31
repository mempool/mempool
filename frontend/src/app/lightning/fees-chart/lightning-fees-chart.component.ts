import {
  Component,
  HostBinding,
  Inject,
  LOCALE_ID,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { formatNumber } from '@angular/common';
import { HttpResponse } from '@angular/common/http';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable, Subscription, combineLatest } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { EChartsOption } from '@app/graphs/echarts';
import { LightningApiService } from '@app/lightning/lightning-api.service';
import { SeoService } from '@app/services/seo.service';
import { StateService } from '@app/services/state.service';
import { StorageService } from '@app/services/storage.service';
import { isMobile } from '@app/shared/common.utils';
import { download } from '@app/shared/graphs.utils';
import { AmountShortenerPipe } from '@app/shared/pipes/amount-shortener.pipe';

const WINDOWS = ['1m', '3m', '6m', '1y', '2y', '3y', 'all'];

type FeesChartMode = 'avg' | 'med';
type FeesChartPoint = [number, number];

interface FeesChartData {
  feeRate: FeesChartPoint[];
  baseFee: FeesChartPoint[];
  capacity: FeesChartPoint[];
}

@Component({
  selector: 'app-lightning-fees-chart',
  templateUrl: './lightning-fees-chart.component.html',
  styleUrls: ['./lightning-fees-chart.component.scss'],
  styles: [
    `
      .loadingGraphs {
        position: absolute;
        top: 50%;
        left: calc(50% - 15px);
        z-index: 99;
      }
    `,
  ],
  standalone: false,
})
export class LightningFeesChartComponent implements OnInit, OnDestroy {
  miningWindowPreference: string;
  radioGroupForm: UntypedFormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  @HostBinding('attr.dir') dir = 'ltr';

  feesObservable$: Observable<{ days: number }>;
  isLoading = true;
  timespan = '';
  chartInstance: any = undefined;
  fragmentSubscription: Subscription;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private lightningApiService: LightningApiService,
    private formBuilder: UntypedFormBuilder,
    private storageService: StorageService,
    private route: ActivatedRoute,
    public stateService: StateService,
    private amountShortenerPipe: AmountShortenerPipe
  ) {}

  ngOnInit(): void {
    let firstRun = true;

    this.seoService.setTitle(
      $localize`:@@633009575969d48bb58013f1d05270799b78c0fc:Lightning Fees & Channel Size`
    );
    this.seoService.setDescription(
      $localize`:@@meta.description.lightning.fees-chart:See the fee rate and base fee charged by Lightning network routing nodes, and the channel size, visualized over time.`
    );
    this.miningWindowPreference =
      [
        this.route.snapshot.fragment,
        this.storageService.getValue('lightningWindowPreference'),
      ].find((timespan) => WINDOWS.includes(timespan)) ?? 'all';
    this.radioGroupForm = this.formBuilder.group({
      dateSpan: this.miningWindowPreference,
      mode: 'med',
    });

    this.fragmentSubscription = this.route.fragment.subscribe((fragment) => {
      if (
        WINDOWS.includes(fragment) &&
        fragment !== this.radioGroupForm.controls.dateSpan.value
      ) {
        this.radioGroupForm.controls.dateSpan.setValue(fragment);
      }
    });

    const mode$: Observable<FeesChartMode> = this.radioGroupForm
      .get('mode')
      .valueChanges.pipe(startWith(this.radioGroupForm.get('mode').value));

    const statistics$ = this.radioGroupForm.get('dateSpan').valueChanges.pipe(
      startWith(this.miningWindowPreference),
      switchMap((timespan): Observable<HttpResponse<any[]>> => {
        this.timespan = timespan;
        if (!firstRun) {
          this.storageService.setValue('lightningWindowPreference', timespan);
        }
        firstRun = false;
        this.miningWindowPreference = timespan;
        this.isLoading = true;
        return this.lightningApiService.cachedRequest(
          this.lightningApiService.listStatistics$,
          250,
          timespan
        );
      })
    );

    this.feesObservable$ = combineLatest([statistics$, mode$]).pipe(
      tap(([response, mode]) => {
        const data = response.body.filter(
          (val) => val[`${mode}_fee_rate`] !== null
        );
        this.prepareChartOptions({
          feeRate: data.map((val) => [
            val.added * 1000,
            val[`${mode}_fee_rate`],
          ]),
          baseFee: data.map((val) => [
            val.added * 1000,
            val[`${mode}_base_fee_mtokens`],
          ]),
          capacity: data.map((val) => [
            val.added * 1000,
            val[`${mode}_capacity`],
          ]),
        });
        this.isLoading = false;
      }),
      map(([response]) => ({
        days: parseInt(response.headers.get('x-total-count'), 10),
      })),
      share()
    );
  }

  ngOnDestroy(): void {
    this.fragmentSubscription?.unsubscribe();
  }

  prepareChartOptions(data: FeesChartData): void {
    const isEmpty = data.feeRate.length === 0;
    const feeRateLabel = $localize`:@@3e322ffba6477484e0dd2e65650fdd70322ea6d0:Fee rate`;
    const baseFeeLabel = $localize`:@@4ca458fe3274d1c79640b052d57cf3b900b650b6:Base fee`;
    const capacityLabel = $localize`:@@lightning.channel-size:Channel size`;
    const legendItem = (name: string): object => ({
      name,
      inactiveColor: 'rgb(110, 112, 121)',
      textStyle: {
        color: 'var(--fg)',
      },
      icon: 'roundRect',
    });

    this.chartOptions = {
      title: !isEmpty
        ? undefined
        : {
            textStyle: {
              color: 'grey',
              fontSize: 15,
            },
            text: $localize`:@@af1176facd00a0580509fb2900ab0cf7f9b39ae7:Indexing in progress`,
            left: 'center',
            top: 'center',
          },
      animation: false,
      color: ['#FFB300', '#1E88E5', '#D81B60'],
      grid: {
        top: 40,
        bottom: 70,
        right: 65,
        left: 65,
      },
      tooltip: {
        show: !isMobile(),
        trigger: 'axis',
        axisPointer: {
          type: 'line',
        },
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: 'var(--tooltip-grey)',
          align: 'left',
        },
        borderColor: '#000',
        formatter: (ticks): string => {
          const units = [
            $localize`:@@8fd0077b032e360ece45c4fd655f85b2400dcb83:ppm`,
            $localize`:@@6acd06bd5a3af583cd46c6d9f7954d7a2b44095e:mSats`,
            $localize`:@@e4b2d9e6a2ab9e6ca34027ec03beaac42b7badd4:sats`,
          ];
          const date = new Date(ticks[0].data[0]).toLocaleDateString(
            this.locale,
            { year: 'numeric', month: 'short', day: 'numeric' }
          );
          const lines = ticks.map(
            (tick) =>
              `<span>${tick.marker} ${tick.seriesName}: ${formatNumber(
                tick.data[1],
                this.locale,
                '1.0-0'
              )} ${units[tick.seriesIndex]}</span>`
          );

          return `<b style="color: white; margin-left: 18px">${date}</b><br>${lines.join(
            '<br>'
          )}`;
        },
      },
      xAxis: isEmpty
        ? undefined
        : {
            type: 'time',
            splitNumber: isMobile() ? 5 : 10,
            axisLabel: {
              hideOverlap: true,
            },
          },
      legend: isEmpty
        ? undefined
        : {
            top: 'top',
            data: [
              legendItem(feeRateLabel),
              legendItem(baseFeeLabel),
              legendItem(capacityLabel),
            ],
            selected:
              JSON.parse(
                this.storageService.getValue('fees_ln_legend') || 'null'
              ) ?? undefined,
          },
      yAxis: isEmpty
        ? undefined
        : [
            {
              type: 'value',
              axisLabel: {
                color: 'rgb(110, 112, 121)',
                formatter: (val: number): string =>
                  `${formatNumber(Math.round(val), this.locale, '1.0-0')}`,
              },
              splitLine: {
                lineStyle: {
                  type: 'dotted',
                  color: 'var(--transparent-fg)',
                  opacity: 0.25,
                },
              },
            },
            {
              min: 0,
              type: 'value',
              position: 'right',
              axisLabel: {
                color: 'rgb(110, 112, 121)',
                formatter: (val: number): string =>
                  `${this.amountShortenerPipe.transform(val, 1)}`,
              },
              splitLine: {
                show: false,
              },
            },
          ],
      series: isEmpty
        ? []
        : [
            {
              zlevel: 1,
              name: feeRateLabel,
              showSymbol: false,
              symbol: 'none',
              data: data.feeRate,
              type: 'line',
              lineStyle: {
                width: 2,
              },
              smooth: false,
            },
            {
              zlevel: 1,
              name: baseFeeLabel,
              showSymbol: false,
              symbol: 'none',
              data: data.baseFee,
              type: 'line',
              lineStyle: {
                width: 2,
              },
              smooth: false,
            },
            {
              zlevel: 0,
              yAxisIndex: 1,
              name: capacityLabel,
              showSymbol: false,
              symbol: 'none',
              data: data.capacity,
              areaStyle: {
                opacity: 0.25,
              },
              type: 'line',
              smooth: false,
            },
          ],
      dataZoom: [
        {
          type: 'inside',
          realtime: true,
          zoomLock: true,
          maxSpan: 100,
          minSpan: 5,
          moveOnMouseMove: false,
        },
        {
          showDetail: false,
          show: true,
          type: 'slider',
          brushSelect: false,
          realtime: true,
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
        },
      ],
    };
  }

  onChartInit(ec): void {
    if (this.chartInstance !== undefined) {
      return;
    }

    this.chartInstance = ec;

    this.chartInstance.on('legendselectchanged', (e) => {
      this.storageService.setValue(
        'fees_ln_legend',
        JSON.stringify(e.selected)
      );
    });
  }

  onSaveChart(): void {
    if (this.isLoading || !this.chartInstance) {
      return;
    }
    // @ts-ignore
    const prevBottom = this.chartOptions.grid.bottom;
    const now = new Date();
    // @ts-ignore
    this.chartOptions.grid.bottom = 40;
    this.chartOptions.backgroundColor = 'var(--active-bg)';
    this.chartInstance.setOption(this.chartOptions);
    download(
      this.chartInstance.getDataURL({
        pixelRatio: 2,
      }),
      `lightning-fees-channel-size-${this.timespan}-${Math.round(
        now.getTime() / 1000
      )}.svg`
    );
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
