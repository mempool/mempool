import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, NgZone, OnInit } from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';
import { BehaviorSubject, combineLatest, forkJoin, Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ActiveFilter, FilterMode, toFilters, toFlags } from '@app/shared/filters.utils';
import { ApiService } from '@app/services/api.service';
import { CurrencyPipe, formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { download } from '@app/shared/graphs.utils';
import { StorageService } from '@app/services/storage.service';
import { MiningService } from '@app/services/mining.service';
import { selectPowerOfTen } from '@app/bitcoin.utils';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { StateService } from '@app/services/state.service';
import { ActivatedRoute, Router } from '@angular/router';

interface GogglesRollup {
  bucketSize: string;
  startHeight: number;
  txCount: number;
  vSizeTotal: number;
}

// a block's max capacity: 4,000,000 WU = 1,000,000 vB
const MAX_BLOCK_VSIZE = 1_000_000;

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

  private intervals = ['24h', '3d', '1w', '1m', '3m', '6m', '1y', '2y', '3y', 'all'];

  // totals depend only on the timespan, so cache them per interval across filter changes
  private totalsCache: Record<string, GogglesRollup[]> = {};

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
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
  }

  ngOnInit(): void {
    if (this.widget) {
      this.miningWindowPreference = '1m';
    } else {
      this.miningWindowPreference = this.miningService.getDefaultTimespan('24h');
    }

    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

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
    ]).pipe(
      switchMap(([timespan, goggle]) => {
        if (!this.widget) {
          this.storageService.setValue('miningWindowPreference', timespan);
        }
        this.timespan = timespan;
        this.isLoading = true;
        const filtered$ = this.apiService.getHistoricalTxCountByFlags$(timespan, goggle.op, goggle.mask?.toString());
        // when filtering, fetch unfiltered totals (cached per interval) to compute each bucket's share
        const totals$ = goggle.mask
          ? (this.totalsCache[timespan]
              ? of(this.totalsCache[timespan])
              : this.apiService.getHistoricalTxCountByFlags$(timespan).pipe(
                  map((res) => res.body || []),
                  tap((body) => { this.totalsCache[timespan] = body; }),
                ))
          : of(null);
        return forkJoin([filtered$, totals$]).pipe(
          tap(([response, totalsBody]) => {
            const body: GogglesRollup[] = response.body || [];
            const filtered = !!this.goggle$.value.mask;
            // when filtering, body is the matched rows and totalsBody the unfiltered totals; otherwise body itself is the totals
            const totalRows: GogglesRollup[] = filtered ? (totalsBody || []) : body;
            const matchedRows: GogglesRollup[] = filtered ? body : [];
            // dims: [startHeight, plotted (avg per block once rolled up), bucketSize, vSizeTotal, txCount]
            const toSeries = (rows: GogglesRollup[]): number[][] => rows.map((row) => {
              const bucketSize = parseInt(row.bucketSize, 10) || 1;
              return [
                row.startHeight,
                bucketSize > 1 ? row.txCount / bucketSize : row.txCount,
                bucketSize,
                row.vSizeTotal,
                row.txCount,
              ];
            });
            this.prepareChartOptions(toSeries(totalRows), toSeries(matchedRows));
            this.isLoading = false;
            this.cd.markForCheck();
          }),
          map(([response]) => {
            const body: GogglesRollup[] = response.body || [];
            const headerCount = parseInt(response.headers.get('x-total-count'), 10);
            return {
              // fall back high so the whole range selector stays available
              blockCount: Number.isFinite(headerCount) ? headerCount : Number.MAX_SAFE_INTEGER,
              txCount: body.reduce((acc, row) => acc + row.txCount, 0),
            };
          }),
          catchError(err => {
            this.prepareChartOptions([], [], err);
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

  // builds the URL fragment: just the interval when no filter is active ("1m"), or "interval=1m&op=and&mask=5" when filtering
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
    const interval = params.get('interval');
    if (this.intervals.includes(interval)) {
      this.radioGroupForm.controls.dateSpan.setValue(interval, { emitEvent: false });
    }
    const maskParam = params.get('mask');
    const mask = maskParam && /^\d+$/.test(maskParam) ? BigInt(maskParam) : 0n;
    const op = (['and', 'or', 'nor'].includes(params.get('op')) ? params.get('op') : 'and') as FilterMode;
    // skip if already applied, otherwise the navigation in onFilterChanged would loop back here
    if ((mask > 0n && (this.goggle$.value.mask ?? 0n) !== mask) || this.goggle$.value.op !== op) {
      this.stateService.activeGoggles$.next({ mode: op, filters: toFilters(mask).map(f => f.key), gradient: 'fee' });
    }
  }

  prepareChartOptions(totalData: number[][], matchedData: number[][], error?): void {
    const filtered = !!this.goggle$.value.mask;
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
          // dims: [startHeight, plotted, bucketSize, vSizeTotal, txCount]
          const baseline = params.find(p => p.seriesIndex === 0) || params[0];
          const matched = params.find(p => p.seriesIndex === 1);
          const startHeight = baseline.data[0];
          const bucketSize = baseline.data[2] || 1;
          const totalCount = baseline.data[4];
          const filtered = !!this.goggle$.value.mask;
          let tooltip = '';

          if (bucketSize > 1) {
            const endHeight = startHeight + bucketSize - 1;
            tooltip += `<b style="color: white; margin-left: 2px">` + $localize`Blocks ${startHeight}–${endHeight}` + `</b><br>`;
          } else {
            tooltip += `<b style="color: white; margin-left: 2px">` + $localize`Block: ${startHeight}` + `</b><br>`;
          }

          const totalLabel = bucketSize > 1 ? $localize`Total transactions` : $localize`Transactions`;
          tooltip += `${baseline.marker} ` + totalLabel + `: ${formatNumber(totalCount, this.locale, '1.0-0')}<br>`;

          if (bucketSize > 1) {
            tooltip += `${baseline.marker} ` + $localize`Avg txs per block` + `: ${formatNumber(totalCount / bucketSize, this.locale, '1.0-2')}<br>`;
          }

          if (filtered) {
            const matchedCount = matched ? matched.data[4] : 0;
            const matchedMarker = matched ? matched.marker : baseline.marker;
            if (bucketSize > 1) {
              tooltip += `${matchedMarker} ` + $localize`Avg txs filtered per block` + `: ${formatNumber(matchedCount / bucketSize, this.locale, '1.0-2')}<br>`;
            } else {
              tooltip += `${matchedMarker} ` + $localize`Matched transactions` + `: ${formatNumber(matchedCount, this.locale, '1.0-0')}<br>`;
            }
            if (totalCount > 0) {
              tooltip += `${matchedMarker} ` + $localize`Share of all txs` + `: ${formatNumber(matchedCount / totalCount * 100, this.locale, '1.0-2')}%<br>`;
            }
            const matchedVSize = matched ? matched.data[3] : 0;
            if (matchedVSize > 0) {
              const weightShare = matchedVSize / (bucketSize * MAX_BLOCK_VSIZE) * 100;
              tooltip += `${matchedMarker} ` + $localize`Share of block weight` + `: ${formatNumber(weightShare, this.locale, '1.0-2')}%<br>`;
            }
          } else {
            const vSizeTotal = baseline.data[3];
            if (vSizeTotal > 0) {
              const weightShare = vSizeTotal / (bucketSize * MAX_BLOCK_VSIZE) * 100;
              tooltip += `${baseline.marker} ` + $localize`Share of block weight` + `: ${formatNumber(weightShare, this.locale, '1.0-2')}%<br>`;
            }
          }
          return tooltip;
        }.bind(this)
      },
      xAxis: totalData.length === 0 ? undefined : {
        name: this.widget ? undefined : $localize`Block height`,
        nameLocation: 'middle',
        nameTextStyle: {
          padding: [10, 0, 0, 0],
        },
        type: 'value',
        min: 'dataMin',
        max: 'dataMax',
        axisLine: { onZero: false },
        splitLine: { show: false },
        axisLabel: {
          formatter: (val): string => `${val}`,
          align: 'center',
          fontSize: 11,
          lineHeight: 12,
          hideOverlap: true,
          padding: [0, 5],
        },
      },
      yAxis: totalData.length === 0 ? undefined : {
        position: 'left',
        axisLabel: {
          color: 'rgb(110, 112, 121)',
          formatter: (val): string => {
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
      series: totalData.length === 0 ? undefined : [
        {
          zlevel: 0,
          name: filtered ? $localize`All transactions` : $localize`Transactions`,
          data: totalData,
          type: 'bar',
          barWidth: '100%',
          large: true,
          itemStyle: { color: '#1E88E5' }, // blue: total tx count
        },
        ...(filtered && matchedData.length > 0 ? [{
          zlevel: 1,
          z: 3,
          name: $localize`Matched`,
          data: matchedData,
          type: 'bar',
          barWidth: '100%',
          barGap: '-100%', // overlay directly on top of the total bars
          large: true,
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
      this.zone.run(() => {
        const url = new RelativeUrlPipe(this.stateService).transform(`/block/${e.data[0]}`);
        this.router.navigate([url]);
      });
    });
  }

  isMobile(): boolean {
    return (window.innerWidth <= 767.98);
  }

  onSaveChart(): void {
    // @ts-ignore
    const prevBottom = this.chartOptions.grid.bottom;
    const now = new Date();
    // @ts-ignore
    this.chartOptions.grid.bottom = 40;
    this.chartOptions.backgroundColor = 'var(--active-bg)';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `block-goggles-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
