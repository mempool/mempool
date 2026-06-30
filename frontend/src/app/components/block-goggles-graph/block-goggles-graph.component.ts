import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, NgZone, OnInit } from '@angular/core';
import { echarts, EChartsOption } from '@app/graphs/echarts';
import { BehaviorSubject, combineLatest, forkJoin, Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, share, startWith, switchMap, tap } from 'rxjs/operators';
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

interface GogglesRollup {
  blocks_count: string;
  start_height: number;
  tx_count: number;
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
            const totalsByHeight: Record<number, number> | null = totalsBody
              ? totalsBody.reduce((acc, row) => { acc[row.start_height] = row.tx_count; return acc; }, {})
              : null;
            // dims: [start_height, tx_count, blocks_count, bucket_total]
            const seriesData = body.map((row) => [
              row.start_height,
              row.tx_count,
              parseInt(row.blocks_count, 10) || 1,
              totalsByHeight ? (totalsByHeight[row.start_height] ?? row.tx_count) : row.tx_count,
            ]);
            this.prepareChartOptions(seriesData);
            this.isLoading = false;
            this.cd.markForCheck();
          }),
          map(([response]) => {
            const body: GogglesRollup[] = response.body || [];
            const headerCount = parseInt(response.headers.get('x-total-count'), 10);
            return {
              // fall back high so the whole range selector stays available
              blockCount: Number.isFinite(headerCount) ? headerCount : Number.MAX_SAFE_INTEGER,
              txCount: body.reduce((acc, row) => acc + row.tx_count, 0),
            };
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
    if (mask > 0n && (this.goggle$.value.mask ?? 0n) !== mask) {
      this.stateService.activeGoggles$.next({ mode: op, filters: toFilters(mask).map(f => f.key), gradient: 'fee' });
    }
  }

  prepareChartOptions(data): void {
    let title: object;
    if (data.length === 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: this.goggle$.value.mask
          ? $localize`No transactions match the selected filters`
          : $localize`:@@23555386d8af1ff73f297e89dd4af3f4689fb9dd:Indexing blocks`,
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
          const item = params[0];
          const startHeight = item.data[0];
          const count = item.data[1];
          const blocksCount = item.data[2] || 1;
          const bucketTotal = item.data[3];
          const filtered = !!this.goggle$.value.mask;
          let tooltip = '';

          if (blocksCount > 1) {
            const endHeight = startHeight + blocksCount - 1;
            tooltip += `<b style="color: white; margin-left: 2px">` + $localize`Blocks ${startHeight}–${endHeight}` + `</b><br>`;
          } else {
            tooltip += `<b style="color: white; margin-left: 2px">` + $localize`Block: ${startHeight}` + `</b><br>`;
          }

          if (blocksCount > 1) {
            tooltip += `${item.marker} ` + $localize`Avg per block` + `: ${formatNumber(count / blocksCount, this.locale, '1.0-2')}<br>`;
          }

          const countLabel = filtered ? $localize`Matched transactions` : (blocksCount > 1 ? $localize`Total transactions` : $localize`Transactions`);
          tooltip += `${item.marker} ` + countLabel + `: ${formatNumber(count, this.locale, '1.0-0')}<br>`;

          if (filtered && bucketTotal > 0) {
            tooltip += `${item.marker} ` + $localize`Share of all txs` + `: ${formatNumber(count / bucketTotal * 100, this.locale, '1.0-2')}%<br>`;
          }
          return tooltip;
        }.bind(this)
      },
      xAxis: data.length === 0 ? undefined : {
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
      yAxis: data.length === 0 ? undefined : {
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
      series: data.length === 0 ? undefined : [{
        zlevel: 0,
        name: $localize`Transactions`,
        data: data,
        type: 'bar',
        barWidth: '100%',
        large: true,
      }],
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
