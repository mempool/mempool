import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostBinding,
  Inject,
  LOCALE_ID,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { EChartsOption } from '@app/graphs/echarts';
import { combineLatest, forkJoin, Observable, of, Subscription } from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  map,
  startWith,
  switchMap,
  tap,
} from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { StateService } from '@app/services/state.service';
import { StorageService } from '@app/services/storage.service';
import { MiningService } from '@app/services/mining.service';
import { download } from '@app/shared/graphs.utils';
import { TransactionFlags } from '@app/shared/filters.utils';

type AdoptionMetric = 'txs' | 'vsize';

interface GogglesRollup {
  startHeight: number;
  avgTimestamp: number;
  txCount: number;
  vSizeTotal: number;
}

type RawGogglesRollup = Record<keyof GogglesRollup, number | string>;

interface AdoptionRollups {
  blockCount: number;
  totals: GogglesRollup[];
  matched: GogglesRollup[][];
  error?: HttpErrorResponse;
}

interface ScriptType {
  name: string;
  color: string;
  flag: bigint;
}

const SCRIPT_TYPES: ScriptType[] = [
  { name: 'Taproot', color: '#D81B60', flag: TransactionFlags.p2tr },
  { name: 'P2WPKH', color: '#8E24AA', flag: TransactionFlags.p2wpkh },
  { name: 'P2PKH', color: '#FB8C00', flag: TransactionFlags.p2pkh },
  { name: 'P2SH', color: '#1E88E5', flag: TransactionFlags.p2sh },
  { name: 'P2WSH', color: '#00ACC1', flag: TransactionFlags.p2wsh },
  { name: 'Bare multisig', color: '#00897B', flag: TransactionFlags.p2ms },
  { name: 'P2PK', color: '#FDD835', flag: TransactionFlags.p2pk },
];

const TIMESPANS = ['24h', '6m', '1y', '2y', '3y', 'all'];

@Component({
  selector: 'app-script-type-adoption-graph',
  templateUrl: './script-type-adoption-graph.component.html',
  styleUrls: ['./script-type-adoption-graph.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScriptTypeAdoptionGraphComponent implements OnInit, OnDestroy {
  @HostBinding('attr.dir') dir = 'ltr';

  radioGroupForm: UntypedFormGroup;
  metricGroupForm: UntypedFormGroup;
  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };
  chartInstance: any = undefined;
  isLoading = true;
  metric: AdoptionMetric = 'txs';
  timespan = '';
  blockCount = 0;

  private subscriptions: Subscription[] = [];

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: UntypedFormBuilder,
    private cd: ChangeDetectorRef,
    public stateService: StateService,
    private route: ActivatedRoute,
    private storageService: StorageService,
    private miningService: MiningService
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.metricGroupForm = this.formBuilder.group({ metric: 'txs' });
  }

  ngOnInit(): void {
    this.seoService.setTitle(
      $localize`:@@mining.script-type-adoption:Script Type Adoption`
    );
    this.seoService.setDescription(
      $localize`:@@meta.descriptions.bitcoin.graphs.script-type-adoption:See how the adoption of each Bitcoin script type has evolved over time, as a share of all transactions or of total block space.`
    );

    let firstRun = true;
    const preference = this.miningService.getDefaultTimespan('24h');
    this.radioGroupForm.controls.dateSpan.setValue(
      TIMESPANS.includes(preference) ? preference : '1y'
    );

    this.subscriptions.push(
      this.route.fragment.subscribe((fragment) => {
        if (TIMESPANS.includes(fragment)) {
          this.radioGroupForm.controls.dateSpan.setValue(fragment);
        }
      })
    );

    const rollups$ = this.radioGroupForm.get('dateSpan').valueChanges.pipe(
      startWith(this.radioGroupForm.controls.dateSpan.value),
      // a radio click sets the value both directly and via the fragment
      distinctUntilChanged(),
      tap((timespan) => {
        if (!firstRun) {
          this.storageService.setValue('miningWindowPreference', timespan);
        }
        firstRun = false;
        this.timespan = timespan;
        this.isLoading = true;
        this.cd.markForCheck();
      }),
      switchMap((timespan) => this.getAdoptionRollups$(timespan))
    );

    this.subscriptions.push(
      combineLatest([
        rollups$,
        this.metricGroupForm
          .get('metric')
          .valueChanges.pipe(
            startWith(this.metricGroupForm.controls.metric.value)
          ),
      ]).subscribe(([rollups, metric]) => {
        // keep the timespan selector usable so a failed request can be retried
        if (!rollups.error) {
          this.blockCount = rollups.blockCount;
        }
        this.metric = metric;
        this.prepareChartOptions(rollups, metric);
        this.isLoading = false;
        this.cd.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  private getAdoptionRollups$(timespan: string): Observable<AdoptionRollups> {
    // 24h is only indexed per block, longer spans per week
    const bucketSize = timespan === '24h' ? '1' : '1008';
    // counts come back as strings from the API
    const toRollups = (rows: RawGogglesRollup[] | null): GogglesRollup[] =>
      (rows || []).map((row) => ({
        startHeight: Number(row.startHeight),
        avgTimestamp: Number(row.avgTimestamp),
        txCount: Number(row.txCount),
        vSizeTotal: Number(row.vSizeTotal),
      }));

    return forkJoin([
      this.apiService.getHistoricalTxCountByFlags$(timespan, bucketSize),
      ...SCRIPT_TYPES.map((type) =>
        this.apiService.getHistoricalTxCountByFlags$(
          timespan,
          bucketSize,
          'or',
          type.flag.toString()
        )
      ),
    ]).pipe(
      map(([totals, ...matched]) => ({
        blockCount: parseInt(totals.headers.get('x-total-count'), 10) || 0,
        totals: toRollups(totals.body),
        matched: matched.map((response) => toRollups(response.body)),
      })),
      catchError((error: HttpErrorResponse) =>
        of({ blockCount: 0, totals: [], matched: [], error })
      )
    );
  }

  prepareChartOptions(rollups: AdoptionRollups, metric: AdoptionMetric): void {
    const field = metric === 'txs' ? 'txCount' : 'vSizeTotal';
    const totals = rollups.totals
      .filter((row) => row[field] > 0)
      .sort((a, b) => a.startHeight - b.startHeight);

    const series = SCRIPT_TYPES.map((type, i) => {
      const matchedByHeight: { [height: number]: GogglesRollup } = {};
      for (const row of rollups.matched[i] || []) {
        matchedByHeight[row.startHeight] = row;
      }
      return {
        name: type.name,
        type: 'line',
        symbol: 'none',
        smooth: true,
        color: type.color,
        lineStyle: { width: 2 },
        emphasis: {
          disabled: true,
          scale: false,
        },
        data: totals.map((total) => [
          total.avgTimestamp * 1000,
          ((matchedByHeight[total.startHeight]?.[field] || 0) / total[field]) *
            100,
        ]),
      };
    });

    const legends = SCRIPT_TYPES.map((type) => ({
      name: type.name,
      inactiveColor: 'rgb(110, 112, 121)',
      textStyle: {
        color: 'var(--fg)',
      },
      icon: 'roundRect',
      itemStyle: {
        color: type.color,
      },
    }));

    const hasData = totals.length > 0;

    this.chartOptions = {
      title: hasData
        ? undefined
        : {
            textStyle: {
              color: 'grey',
              fontSize: 15,
            },
            text: this.getEmptyMessage(rollups.error),
            left: 'center',
            top: 'center',
          },
      animation: false,
      grid: {
        right: 45,
        left: 25,
        bottom: 70,
        top: this.isMobile() ? 70 : 50,
      },
      tooltip: {
        show: !this.isMobile(),
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
        formatter: (params): string => {
          const date = new Date(params[0].axisValue).toLocaleString(
            this.locale,
            this.timespan === '24h'
              ? {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: 'numeric',
                }
              : { year: 'numeric', month: 'short', day: 'numeric' }
          );
          let tooltip = `<b style="color: white; margin-left: 2px">${date}</b><br>`;
          for (const param of params) {
            tooltip += `${param.marker} ${
              param.seriesName
            }: ${param.value[1].toFixed(2)}%<br>`;
          }
          return tooltip;
        },
      },
      xAxis: hasData
        ? {
            type: 'time',
            splitNumber: this.isMobile() ? 5 : 10,
            axisLabel: {
              hideOverlap: true,
            },
          }
        : undefined,
      legend: hasData
        ? {
            top: 'top',
            data: legends,
          }
        : undefined,
      yAxis: hasData
        ? {
            position: 'right',
            axisLabel: {
              color: 'rgb(110, 112, 121)',
              formatter: (val): string => `${val}%`,
            },
            splitLine: {
              lineStyle: {
                type: 'dotted',
                color: 'var(--transparent-fg)',
                opacity: 0.25,
              },
            },
            type: 'value',
            max: 100,
            min: 0,
          }
        : undefined,
      series: hasData ? series : [],
      dataZoom: hasData
        ? [
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
          ]
        : undefined,
    };
  }

  getEmptyMessage(error?: HttpErrorResponse): string {
    if (error?.status === 404) {
      return $localize`Block summaries indexing is required for this graph`;
    }
    if (error) {
      return $localize`:error.general-loading-data:Error loading data.`;
    }
    return $localize`:@@23555386d8af1ff73f297e89dd4af3f4689fb9dd:Indexing blocks`;
  }

  onChartInit(ec): void {
    this.chartInstance = ec;
  }

  isMobile(): boolean {
    return window.innerWidth <= 767.98;
  }

  onSaveChart(): void {
    if (!this.chartInstance || !this.chartOptions.grid) {
      return;
    }
    const grid = this.chartOptions.grid as { bottom: number };
    const prevBottom = grid.bottom;
    const now = new Date();
    grid.bottom = 30;
    this.chartOptions.backgroundColor = 'var(--active-bg)';
    this.chartInstance.setOption(this.chartOptions);
    download(
      this.chartInstance.getDataURL({
        pixelRatio: 2,
        excludeComponents: ['dataZoom'],
      }),
      `script-type-adoption-${this.metric}-${this.timespan}-${Math.round(
        now.getTime() / 1000
      )}.svg`
    );
    grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
