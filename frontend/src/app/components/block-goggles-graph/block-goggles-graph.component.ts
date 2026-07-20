import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, NgZone, OnInit } from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';
import { BehaviorSubject, combineLatest, forkJoin, Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ActiveFilter, FilterMode, toFilters, toFlags } from '@app/shared/filters.utils';
import { ApiService } from '@app/services/api.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { download } from '@app/shared/graphs.utils';
import { StorageService } from '@app/services/storage.service';
import { MiningService } from '@app/services/mining.service';
import { selectPowerOfTen } from '@app/bitcoin.utils';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { StateService } from '@app/services/state.service';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpResponse } from '@angular/common/http';
import { VbytesPipe } from '@app/shared/pipes/bytes-pipe/vbytes.pipe';

interface GogglesRollup {
  bucketSize: string;
  startHeight: number;
  txCount: number;
  vSizeTotal: number;
}

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
  count = $localize`:@@8177873832400820695:Count`;

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
    this.unitGroupForm = this.formBuilder.group({ unitType: 'txCount'});
    this.unitGroupForm.controls.unitType.setValue('txCount');
  }

  ngOnInit(): void {
    if (this.widget) {
      this.miningWindowPreference = '1m';
    } else {
      this.miningWindowPreference = this.miningService.getDefaultTimespan('24h');
    }

    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);
    this.unitGroupForm = this.formBuilder.group({ unitType: 'txCount'});
    this.unitGroupForm.controls.unitType.setValue('txCount');

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
    ]).pipe(
      switchMap(([timespan, goggle, unitType]) => {
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
        const unit = of(unitType);
        return forkJoin<[HttpResponse<GogglesRollup[]>, GogglesRollup[], string]>([filtered$, totals$, unit]).pipe(
          tap(([response, totalsBody, unit]) => {
            const body: GogglesRollup[] = response.body || [];
            const filtered = !!this.goggle$.value.mask;
            // when filtering, body is the matched rows and totalsBody the unfiltered totals; otherwise body itself is the totals
            const totalRows: GogglesRollup[] = filtered ? (totalsBody || []) : body;
            const matchedRows: GogglesRollup[] = filtered ? body : [];
            const unitIsTx = unit === 'txCount';
            // dims: [startHeight, plotted (avg per block once rolled up), bucketSize, txCount, vSizeTotal]
            const toSeries = (rows: GogglesRollup[]): number[][] => rows.map((row) => {
              const bucketSize = parseInt(row.bucketSize, 10) || 1;
              // vsize_total is a BIGINT sum and arrives as a string, so coerce before it reaches the chart/tooltip
              const txCount = Number(row.txCount);
              const vSizeTotal = Number(row.vSizeTotal);
              const selected = unitIsTx ? txCount : vSizeTotal;
              const plotted = bucketSize > 1 ? selected / bucketSize : selected;
              return [row.startHeight, plotted, bucketSize, txCount, vSizeTotal];
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
  getFragment(interval?: string, unitType?: string): string {
    const timespan = interval ?? this.radioGroupForm.controls.dateSpan.value;
    const unit = unitType ?? this.unitGroupForm.controls.unitType.value;
    const { op, mask } = this.goggle$.value;
    return mask ? `interval=${timespan}&unit=${unit}&op=${op}&mask=${mask.toString()}` : `interval=${timespan}&unit=${unit}`;
  }

  // restores state from a fragment in either form, letting block-filters pick up restored filters via activeGoggles$
  private parseFragment(fragment: string): void {
    if (!fragment) {
      return;
    }
    const params = new URLSearchParams(fragment);
    const rawInterval = params.get('interval') ?? '';
    const interval = this.intervals.includes(rawInterval) ? rawInterval : this.radioGroupForm.controls.dateSpan.value;
    const unit = ['vb', 'txCount'].includes(params.get('unit')) ? params.get('unit') : 'txCount';
    const maskParam = params.get('mask') ?? '';
    const mask = maskParam && /^\d+$/.test(maskParam) ? BigInt(maskParam) : 0n;
    const op = (['and', 'or', 'nor'].includes(params.get('op')) ? params.get('op') : 'and') as FilterMode;

    this.radioGroupForm.controls.dateSpan.setValue(interval, { emitEvent: false });
    this.unitGroupForm.controls.unitType.setValue(unit, { emitEvent: false });
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
          // dims: [startHeight, plotted, bucketSize, txCount, vSizeTotal]
          const baseline = params.find(p => p.seriesIndex === 0) || params[0];
          const matched = params.find(p => p.seriesIndex === 1);
          const startHeight = baseline.data[0];
          const bucketSize = baseline.data[2] || 1;
          const baseTxCount = baseline.data[3];
          const baseVSize = baseline.data[4];
          const filtered = !!this.goggle$.value.mask;
          const unitIsTxCount = this.unitGroupForm.controls.unitType.value === 'txCount';
          const rolledUp = bucketSize > 1;

          const fmtCount = (v): string => formatNumber(v, this.locale, '1.0-0');
          const fmtAvg = (v): string => formatNumber(v, this.locale, '1.0-2');
          const fmtVSize = (v): string => new VbytesPipe().transform(v, 2, 'vB', undefined, true);
          const fmtPct = (v): string => formatNumber(v, this.locale, '1.0-2') + '%';

          let tooltip = '';
          if (rolledUp) {
            const endHeight = startHeight + bucketSize - 1;
            tooltip += `<b style="color: white; margin-left: 2px">` + $localize`Blocks ${startHeight}–${endHeight}` + `</b><br>`;
          } else {
            tooltip += `<b style="color: white; margin-left: 2px">` + $localize`Block: ${startHeight}` + `</b><br>`;
          }

          // baseline (unfiltered total) metric, labelled/formatted for the active unit
          if (unitIsTxCount) {
            tooltip += `${baseline.marker} ` + (rolledUp ? $localize`Total transactions` : $localize`Transactions`) + `: ${fmtCount(baseTxCount)}<br>`;
            if (rolledUp) {
              tooltip += `${baseline.marker} ` + $localize`Avg txs per block` + `: ${fmtAvg(baseTxCount / bucketSize)}<br>`;
            }
          } else {
            tooltip += `${baseline.marker} ` + (rolledUp ? $localize`Total size` : $localize`Size`) + `: ${fmtVSize(baseVSize)}<br>`;
            if (rolledUp) {
              tooltip += `${baseline.marker} ` + $localize`Avg size per block` + `: ${fmtVSize(baseVSize / bucketSize)}<br>`;
            }
          }

          if (filtered && matched) {
            const matchedTxCount = matched.data[3];
            const matchedVSize = matched.data[4];
            const m = matched.marker;
            if (unitIsTxCount) {
              tooltip += rolledUp
                ? `${m} ` + $localize`Avg matched per block` + `: ${fmtAvg(matchedTxCount / bucketSize)}<br>`
                : `${m} ` + $localize`Matched transactions` + `: ${fmtCount(matchedTxCount)}<br>`;
              if (matchedTxCount > 0) {
                tooltip += `${m} ` + $localize`Share of all txs` + `: ${fmtPct(matchedTxCount / baseTxCount * 100)}<br>`;
              }
            } else {
              tooltip += rolledUp
                ? `${m} ` + $localize`Avg matched vSize per block` + `: ${fmtVSize(matchedVSize / bucketSize)}<br>`
                : `${m} ` + $localize`Matched vSize` + `: ${fmtVSize(matchedVSize)}<br>`;
              if (matchedVSize > 0) {
                tooltip += `${m} ` + $localize`Share of block vSize` + `: ${fmtPct(matchedVSize / (baseVSize) * 100)}<br>`;
              }
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
            if (this.unitGroupForm.controls.unitType.value === 'vb') {
              return new VbytesPipe().transform(val, 0, 'vB', undefined, true);
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
