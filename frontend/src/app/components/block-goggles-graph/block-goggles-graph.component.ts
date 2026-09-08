import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, NgZone, OnInit } from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';
import { BehaviorSubject, combineLatest, forkJoin, Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ActiveFilter, FilterMode, toFilters, toFlags } from '@app/shared/filters.utils';
import { ApiService } from '@app/services/api.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { download, formatterXAxis, formatterXAxisLabel, formatterXAxisTimeCategory } from '@app/shared/graphs.utils';
import { StorageService } from '@app/services/storage.service';
import { MiningService } from '@app/services/mining.service';
import { selectPowerOfTen } from '@app/bitcoin.utils';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { StateService } from '@app/services/state.service';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpResponse } from '@angular/common/http';
import { VbytesPipe } from '@app/shared/pipes/bytes-pipe/vbytes.pipe';
import { SeoService } from '@app/services/seo.service';

interface GogglesRollup {
  bucketSize: string;
  startHeight: number;
  avgTimestamp: number;
  txCount: number;
  vSizeTotal: number;
}

interface GogglesDatum {
  value: number;
  startHeight: number;
  bucketSize: number;
  txCount: number;
  vSizeTotal: number;
  timestampMs: number;
  baseTxCount?: number;
  baseVSize?: number;
}

const INTERVAL_PRESETS: Record<string, number[]> = {
  '24h': [1],
  '6m': [1008, 4032],
  '1y': [1008, 4032],
  '2y': [1008, 4032],
  '3y': [1008, 4032],
  'all': [1008, 4032],
};

@Component({
  selector: 'app-block-goggles-graph',
  templateUrl: './block-goggles-graph.component.html',
  styleUrls: ['./block-goggles-graph.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 99;
    }
  `],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockGogglesGraphComponent implements OnInit {
  @Input() widget = false;
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  miningWindowPreference: string;
  radioGroupForm: UntypedFormGroup;
  unitGroupForm: UntypedFormGroup;
  bucketGroupForm: UntypedFormGroup;
  modeGroupForm: UntypedFormGroup;
  count = $localize`:@@8177873832400820695:Count`;
  allLabel = $localize`All transactions`;
  transactionsLabel = $localize`Transactions`;
  matchedLabel = $localize`Matched`;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  statsObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;
  timespan = '';
  chartInstance: any = undefined;

  // active goggles filter; empty op/mask means no filter, so the backend returns total tx counts
  goggle$ = new BehaviorSubject<{ op?: FilterMode, mask?: bigint }>({});

  private intervals = Object.keys(INTERVAL_PRESETS);

  private bucketTimestampByHeight = new Map<number, number>();

  private totalsCache: Record<string, GogglesRollup[]> = {};

  private relativeMode = false;

  private prefs: { unit: string, bucket: number, mode: string } = { unit: 'txCount', bucket: 1008, mode: 'abs' };

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private apiService: ApiService,
    private formBuilder: UntypedFormBuilder,
    private storageService: StorageService,
    private miningService: MiningService,
    public stateService: StateService,
    private router: Router,
    private zone: NgZone,
    private route: ActivatedRoute,
    private cd: ChangeDetectorRef,
    private seoService: SeoService,
    private vbytesPipe: VbytesPipe,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
    this.unitGroupForm = this.formBuilder.group({ unitType: 'txCount'});
    this.unitGroupForm.controls.unitType.setValue('txCount');
    this.bucketGroupForm = this.formBuilder.group({ bucketSize: 1008});
    this.bucketGroupForm.controls.bucketSize.setValue(1008);
    this.modeGroupForm = this.formBuilder.group({ mode: 'abs' });
    this.modeGroupForm.controls.mode.setValue('abs');
  }

  ngOnInit(): void {
    let firstRun = true;
    if (this.widget) {
      this.miningWindowPreference = '6m';
    } else {
      this.seoService.setTitle($localize`Mempool Goggles`);
      this.seoService.setDescription($localize`:@@meta.description.bitcoin.graphs.goggles:See Bitcoin transactions matching Mempool Goggles filters visualized over time.`);
      this.miningWindowPreference = this.miningService.getDefaultTimespan('24h');
    }
    if (!this.intervals.includes(this.miningWindowPreference)) {
      this.miningWindowPreference = '1y';
    }

    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);
    let storedPrefs: any = {};
    try {
      storedPrefs = JSON.parse(this.storageService.getValue('goggles_prefs')) ?? {};
    } catch {
      storedPrefs = {};
    }
    if (['vb', 'txCount'].includes(storedPrefs.unit)) {
      this.prefs.unit = storedPrefs.unit;
    }
    if ([1008, 4032].includes(storedPrefs.bucket)) {
      this.prefs.bucket = storedPrefs.bucket;
    }
    if (['abs', 'rel'].includes(storedPrefs.mode)) {
      this.prefs.mode = storedPrefs.mode;
    }
    this.unitGroupForm = this.formBuilder.group({ unitType: this.prefs.unit });
    this.unitGroupForm.controls.unitType.setValue(this.prefs.unit);
    this.bucketGroupForm.controls.bucketSize.setValue(this.prefs.bucket, { emitEvent: false });
    this.modeGroupForm.controls.mode.setValue(this.prefs.mode, { emitEvent: false });

    if (!this.widget) {
      this.route
        .fragment
        .subscribe((fragment) => {
          this.parseFragment(fragment);
        });
    }

    this.statsObservable$ = combineLatest([
      this.radioGroupForm.get('dateSpan').valueChanges.pipe(
        startWith(this.radioGroupForm.controls.dateSpan.value),
        distinctUntilChanged(),
      ),
      // debounce so toggling several flags fires one request; startWith keeps the first paint immediate
      this.goggle$.pipe(
        debounceTime(250),
        startWith(this.goggle$.value),
        distinctUntilChanged((a, b) => a.op === b.op && a.mask === b.mask),
      ),
      this.unitGroupForm.get('unitType').valueChanges.pipe(
        startWith(this.unitGroupForm.controls.unitType.value),
        distinctUntilChanged(),
      ),
      this.bucketGroupForm.get('bucketSize').valueChanges.pipe(
        startWith(this.bucketGroupForm.controls.bucketSize.value),
        distinctUntilChanged(),
      ),
      this.modeGroupForm.get('mode').valueChanges.pipe(
        startWith(this.modeGroupForm.controls.mode.value),
        distinctUntilChanged(),
      ),
    ]).pipe(
      switchMap(([timespan, goggle, unitType, bucketSize, mode]) => {
        if (!this.widget && !firstRun && timespan !== this.timespan) {
          this.storageService.setValue('miningWindowPreference', timespan);
        }
        firstRun = false;
        this.timespan = timespan;
        this.isLoading = true;
        // reconcile the bucket size with the interval (e.g. 24h is per-block only) and keep the UI radio in sync
        const allowedBuckets = this.bucketSizesForInterval(timespan);
        const effectiveBucket = allowedBuckets.includes(bucketSize) ? bucketSize : allowedBuckets[0];
        if (effectiveBucket !== this.bucketGroupForm.controls.bucketSize.value) {
          this.bucketGroupForm.controls.bucketSize.setValue(effectiveBucket, { emitEvent: false });
        }
        const effectiveMode = goggle.mask ? mode : 'abs';
        if (effectiveMode !== this.modeGroupForm.controls.mode.value) {
          this.modeGroupForm.controls.mode.setValue(effectiveMode, { emitEvent: false });
        }
        this.prefs.unit = unitType;
        if (allowedBuckets.length > 1) {
          this.prefs.bucket = effectiveBucket;
        }
        if (goggle.mask) {
          this.prefs.mode = effectiveMode;
        }
        this.storageService.setValue('goggles_prefs', JSON.stringify(this.prefs));
        const cacheKey = `${timespan}:${effectiveBucket}`;
        const filtered$ = this.apiService.getHistoricalTxCountByFlags$(timespan, effectiveBucket.toString(), goggle.op, goggle.mask?.toString());
        const totals$ = goggle.mask
          ? (this.totalsCache[cacheKey]
              ? of(this.totalsCache[cacheKey])
              : this.apiService.getHistoricalTxCountByFlags$(timespan, effectiveBucket.toString()).pipe(
                  map((res) => res.body || []),
                  tap((body) => { this.totalsCache[cacheKey] = body; }),
                ))
          : of(null);
        const unit = of(unitType);
        return forkJoin<[HttpResponse<GogglesRollup[]>, GogglesRollup[], string]>([filtered$, totals$, unit]).pipe(
          tap(([response, totalsBody, unit]) => {
            const body: GogglesRollup[] = response.body || [];
            const filtered = !!this.goggle$.value.mask;
            // when filtering, body is the matched rows and totalsBody the unfiltered totals; otherwise body itself is the totals
            const totalRows: GogglesRollup[] = filtered ? (totalsBody || []) : body;
            const matchedRows: GogglesRollup[] = filtered ? body : [];
            const unitIsTx = unit === 'txCount';
            this.relativeMode = filtered && effectiveMode === 'rel';
            const matchedByHeight = new Map<number, GogglesRollup>();
            for (const row of matchedRows) {
              matchedByHeight.set(row.startHeight, row);
            }
            const sorted = [...totalRows].sort((a, b) => a.startHeight - b.startHeight);
            const categories = sorted.map((row) => row.startHeight);
            this.bucketTimestampByHeight = new Map(sorted.map((row) => [row.startHeight, Number(row.avgTimestamp) * 1000]));
            const toSeries = (matched = false): GogglesDatum[] => sorted.map((row) => {
              const bucketSize = parseInt(row.bucketSize, 10) || 1;
              const source = matched ? matchedByHeight.get(row.startHeight) : row;
              const txCount = source ? Number(source.txCount) : 0;
              const vSizeTotal = source ? Number(source.vSizeTotal) : 0;
              const selected = unitIsTx ? txCount : vSizeTotal;
              const plotted = bucketSize > 1 ? selected / bucketSize : selected;
              const datum: GogglesDatum = { value: plotted, startHeight: row.startHeight, bucketSize, txCount, vSizeTotal, timestampMs: Number(row.avgTimestamp) * 1000 };
              if (matched) {
                datum.baseTxCount = Number(row.txCount);
                datum.baseVSize = Number(row.vSizeTotal);
                if (this.relativeMode) {
                  const base = unitIsTx ? datum.baseTxCount : datum.baseVSize;
                  datum.value = base > 0 ? selected / base * 100 : 0;
                }
              } else if (this.relativeMode) {
                datum.value = 100;
              }
              return datum;
            });
            this.prepareChartOptions(categories, toSeries(), filtered ? toSeries(true) : []);
            this.isLoading = false;
            this.cd.markForCheck();
          }),
          map(([response]) => {
            const body: GogglesRollup[] = response.body || [];
            const headerCount = parseInt(response.headers.get('x-total-count'), 10);
            return {
              blockCount: Number.isFinite(headerCount) ? headerCount : Number.MAX_SAFE_INTEGER,
              txCount: body.reduce((acc, row) => acc + row.txCount, 0),
            };
          }),
          catchError(err => {
            this.prepareChartOptions([], [], [], err);
            this.isLoading = false;
            this.cd.markForCheck();
            return of({ blockCount: Number.MAX_SAFE_INTEGER, txCount: 0 });
          }),
        );
      }),
      share(),
    );
  }

  onFilterChanged(activeFilter: ActiveFilter | null): void {
    const mask = activeFilter ? toFlags(activeFilter.filters) : 0n;
    this.goggle$.next(mask > 0n
      ? { op: activeFilter.mode, mask }
      : {}
    );
    if (!this.widget) {
      this.router.navigate([], { relativeTo: this.route, fragment: this.getFragment(), replaceUrl: true });
    }
  }

  // builds the URL fragment: just the interval when no filter is active ("1y"), or "interval=1y&op=and&mask=5" when filtering
  getFragment(interval?: string): string {
    const timespan = interval ?? this.radioGroupForm.controls.dateSpan.value;
    const { op, mask } = this.goggle$.value;
    return mask ? `interval=${timespan}&op=${op}&mask=${mask.toString()}` : timespan;
  }

  // restores state from a fragment in either form, letting block-filters pick up restored filters via activeGoggles$
  private parseFragment(fragment: string): void {
    if (!fragment) {
      return;
    }
    if (this.intervals.includes(fragment)) {
      this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
      return;
    }
    const params = new URLSearchParams(fragment);
    const rawInterval = params.get('interval') ?? '';
    const interval = this.intervals.includes(rawInterval) ? rawInterval : this.radioGroupForm.controls.dateSpan.value;
    const maskParam = params.get('mask') ?? '';
    const mask = maskParam && /^\d+$/.test(maskParam) ? BigInt(maskParam) : 0n;
    const op = (['and', 'or', 'nor'].includes(params.get('op')) ? params.get('op') : 'and') as FilterMode;

    this.radioGroupForm.controls.dateSpan.setValue(interval, { emitEvent: false });
    // skip if already applied, otherwise the navigation in onFilterChanged would loop back here
    if ((mask > 0n && (this.goggle$.value.mask ?? 0n) !== mask) || this.goggle$.value.op !== op) {
      this.stateService.activeGoggles$.next({ mode: op, filters: toFilters(mask).map(f => f.key), gradient: 'fee' });
    }
  }

  prepareChartOptions(categories: number[], totalData: GogglesDatum[], matchedData: GogglesDatum[], error?): void {
    const filtered = !!this.goggle$.value.mask;
    const perBlock = totalData.length > 0 && totalData[0].bucketSize === 1;
    let title: object;
    if (totalData.length === 0 ) {
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
    if (error && error.status === 404) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: $localize`Block summaries indexing is required for this graph`,
        left: 'center',
        top: 'center'
      };
    }

    const unitIsVb = this.unitGroupForm.controls.unitType.value === 'vb';
    const yAxisName = this.relativeMode
      ? (unitIsVb ? $localize`Share of vsize (%)` : $localize`Share of txs (%)`)
      : (unitIsVb ? $localize`Total vsize (vB)` : $localize`Total txs (Count)`);
    this.chartOptions = {
      title,
      color: ['#1E88E5'],
      animation: false,
      grid: {
        right: this.right,
        left: this.left,
        bottom: this.widget ? 30 : 80,
        top: this.widget ? 20 : (this.isMobile() ? 10 : 50),
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
          color: 'var(--tooltip-grey)',
          align: 'left',
        },
        borderColor: '#000',
        formatter: function(params): string {
          if (!params || params.length <= 0) {
            return '';
          }
          const baseline = params.find(p => p.seriesId === 'total');
          const matched = params.find(p => p.seriesId === 'matched');
          const anchor = baseline || matched;
          if (!anchor) {
            return '';
          }
          const startHeight = anchor.data.startHeight;
          const bucketSize = anchor.data.bucketSize || 1;
          const timestampMs = anchor.data.timestampMs;
          const baseTxCount = baseline ? baseline.data.txCount : (matched ? matched.data.baseTxCount : 0);
          const baseVSize = baseline ? baseline.data.vSizeTotal : (matched ? matched.data.baseVSize : 0);
          const filtered = !!this.goggle$.value.mask;
          const unitIsTxCount = this.unitGroupForm.controls.unitType.value === 'txCount';
          const rolledUp = bucketSize > 1;

          const fmtCount = (v): string => formatNumber(v, this.locale, '1.0-0');
          const fmtAvg = (v): string => formatNumber(v, this.locale, '1.0-2');
          const fmtVSize = (v): string => this.vbytesPipe.transform(v, 2, 'vB', undefined, true);
          const fmtPct = (v): string => formatNumber(v, this.locale, '1.0-2') + '%';

          let tooltip = '';
          tooltip += `<b style="color: white; margin-left: 2px">${formatterXAxis(this.locale, this.timespan, timestampMs)}</b><br>`;

          const fmtVal = (v): string => unitIsTxCount
            ? (rolledUp ? fmtAvg(v / bucketSize) : fmtCount(v))
            : fmtVSize(rolledUp ? v / bucketSize : v);

          if (baseline) {
            tooltip += `${baseline.marker} ${baseline.seriesName}: ${fmtVal(unitIsTxCount ? baseTxCount : baseVSize)}<br>`;
          }

          if (filtered && matched) {
            const matchedVal = unitIsTxCount ? matched.data.txCount : matched.data.vSizeTotal;
            const base = unitIsTxCount ? baseTxCount : baseVSize;
            tooltip += `${matched.marker} ${matched.seriesName}: ${fmtVal(matchedVal)}<br>`;
            if (base > 0) {
              tooltip += `${matched.marker} ` + $localize`Share` + `: ${fmtPct(matchedVal / base * 100)}<br>`;
            }
          }

          if (rolledUp) {
            tooltip += `<small>` + $localize`*On average between blocks ${startHeight} - ${startHeight + bucketSize - 1}` + `</small>`;
          } else {
            tooltip += `<small>` + $localize`At block: ${startHeight}` + `</small>`;
          }
          return tooltip;
        }.bind(this)
      },
      xAxis: totalData.length === 0 ? undefined : {
        name: this.widget ? undefined : formatterXAxisLabel(this.locale, this.timespan),
        nameLocation: 'middle',
        nameTextStyle: {
          padding: [10, 0, 0, 0],
        },
        type: 'category',
        data: categories,
        axisLine: { onZero: false },
        splitLine: { show: false },
        axisLabel: {
          formatter: (value): string => {
            const ts = this.bucketTimestampByHeight.get(Number(value));
            return ts !== undefined ? formatterXAxisTimeCategory(this.locale, this.timespan, ts) : '';
          },
          align: 'center',
          fontSize: 11,
          lineHeight: 12,
          hideOverlap: true,
          padding: [0, 5],
        },
      },
      yAxis: totalData.length === 0 ? undefined : {
        position: 'left',
        name: this.widget ? undefined : yAxisName,
        nameLocation: 'middle',
        nameRotate: 90,
        nameGap: 55,
        nameTextStyle: {
          fontSize: 11,
          color: 'rgb(110, 112, 121)'
        },
        axisLabel: {
          color: 'rgb(110, 112, 121)',
          formatter: (val): string => {
            if (this.relativeMode) {
              return `${val}%`;
            }
            if (this.unitGroupForm.controls.unitType.value === 'vb') {
              return this.vbytesPipe.transform(val, 0, 'vB', undefined, true);
            }
            const selectedPowerOfTen: any = selectPowerOfTen(val);
            const newVal = Math.round(val / selectedPowerOfTen.divider);
            return `${newVal}${selectedPowerOfTen.unit}`;
          },
        },
        splitLine: {
          lineStyle: {
            type: 'dotted',
            color: 'var(--transparent-fg)',
            opacity: 0.25,
          }
        },
        type: 'value',
      },
      legend: (this.widget || totalData.length === 0 || !filtered) ? undefined : {
        top: 'top',
        data: [
          {
            name: this.allLabel,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: { color: 'var(--fg)' },
            icon: 'roundRect',
          },
          {
            name: this.matchedLabel,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: { color: 'var(--fg)' },
            icon: 'roundRect',
          },
        ],
        selected: JSON.parse(this.storageService.getValue('goggles_legend') || 'null') ?? {
          [this.allLabel]: true,
          [this.matchedLabel]: true,
        },
      },
      series: totalData.length === 0 ? undefined : [
        {
          id: 'total',
          zlevel: 0,
          name: filtered ? this.allLabel : this.transactionsLabel,
          data: totalData,
          type: 'bar',
          barWidth: '100%',
          cursor: perBlock ? 'pointer' : 'default',
          itemStyle: { color: '#1E88E5' }, // blue: total tx count
        },
        ...(filtered && matchedData.length > 0 ? [{
          id: 'matched',
          zlevel: 1,
          z: 3,
          name: this.matchedLabel,
          data: matchedData,
          type: 'bar',
          barWidth: '100%',
          barGap: '-100%', // overlay directly on top of the total bars
          cursor: perBlock ? 'pointer' : 'default',
          itemStyle: { color: '#8E24AA' },
        }] : []),
      ],
      dataZoom: this.widget ? null : [{
        type: 'inside',
        realtime: true,
        zoomLock: true,
        maxSpan: 100,
        minSpan: 5,
        moveOnMouseMove: false,
      }, {
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
          }
        },
      }],
    };
  }

  onChartInit(ec): void {
    if (this.chartInstance !== undefined) {
      return;
    }

    this.chartInstance = ec;

    this.chartInstance.on('click', (e) => {
      if (e.data.bucketSize > 1) {
        return;
      }
      this.zone.run(() => {
        const url = new RelativeUrlPipe(this.stateService).transform(`/block/${e.data.startHeight}`);
        this.router.navigate([url]);
      });
    });

    this.chartInstance.on('legendselectchanged', (e) => {
      this.storageService.setValue('goggles_legend', JSON.stringify(e.selected));
    });
  }

  isMobile(): boolean {
    return (window.innerWidth <= 767.98);
  }

  // the bucket sizes a given interval can be viewed at (24h is per-block only; longer ranges are week/month)
  bucketSizesForInterval(interval: string): number[] {
    return INTERVAL_PRESETS[interval] ?? [1008, 4032];
  }

  // for the template: the bucket options for the currently selected interval (used to show/hide the selector)
  get availableBucketSizes(): number[] {
    return this.bucketSizesForInterval(this.radioGroupForm.controls.dateSpan.value);
  }

  get isFiltered(): boolean {
    return !!this.goggle$.value.mask;
  }

  onSaveChart(): void {
    // @ts-ignore
    const prevBottom = this.chartOptions.grid.bottom;
    // @ts-ignore
    const prevTitle = { ...this.chartOptions.title ?? {text: ''}};
    // @ts-ignore
    const prevYAxisNameStyle: any = { ...this.chartOptions.yAxis.nameTextStyle};
    const now = new Date();
    const { op, mask } = this.goggle$.value;
    const filters = mask ? toFilters(mask).map(f => f.label) : [];
    if (this.chartOptions.legend) {
      const currentLegend = this.chartInstance.getOption().legend;
      if (currentLegend?.[0]?.selected) {
        // @ts-ignore
        this.chartOptions.legend.selected = currentLegend[0].selected;
      }
    }
    // @ts-ignore
    this.chartOptions.grid.bottom = 90;
    this.chartOptions.backgroundColor = 'var(--active-bg)';
    const bucket = this.bucketGroupForm.controls.bucketSize.value;
    const bucketSuffix = bucket === 1008
      ? $localize`Weekly average`
      : bucket === 4032
        ? $localize`Monthly average`
        : '';
    let expression = '';
    if (filters.length && this.chartOptions.xAxis) {
      if (op === 'nor') {
        expression += $localize`matching none of: `;
      } else if (op === 'or') {
        expression += $localize`matching any of: `;
      } else {
        expression += $localize`matching all of: `;
      }
      expression += filters.length > 1 ? filters.join(' - ') : filters[0];
    }
    const text = `${bucketSuffix} ${$localize`of transactions`} ${expression}`;
    this.chartOptions.title = {
      text,
      textStyle: { color: 'white', fontSize: 15, fontWeight: 'normal' },
      left: 'center',
      bottom: 15,
    };
    // @ts-ignore
    this.chartOptions.yAxis.nameTextStyle = {
      fontSize: 14,
      color: 'white',
    };
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `block-goggles-${this.timespan}${mask ? `-${op}-${mask.toString()}` : ''}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartOptions.title = prevTitle;
    // @ts-ignore
    this.chartOptions.yAxis.nameTextStyle = prevYAxisNameStyle;
    this.chartInstance.setOption(this.chartOptions);
  }
}
