import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, NgZone, OnInit } from '@angular/core';
import { echarts, EChartsOption } from '@app/graphs/echarts';
import { Observable } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
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
          if (['24h', '3d', '1w', '1m', '3m', '6m', '1y', '2y', '3y', 'all'].indexOf(fragment) > -1) {
            this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
          }
        });
    }

    this.statsObservable$ = this.radioGroupForm.get('dateSpan').valueChanges.pipe(
      startWith(this.radioGroupForm.controls.dateSpan.value),
      switchMap((timespan) => {
        if (!this.widget) {
          this.storageService.setValue('miningWindowPreference', timespan);
        }
        this.timespan = timespan;
        this.isLoading = true;
        // the backend owns the blockspan/rollup tier for each interval; the frontend just asks for it
        return this.apiService.getHistoricalTxCountByFlags$(timespan).pipe(
          tap((response) => {
            const body: GogglesRollup[] = response.body || [];
            const seriesData = body.map((row) => [row.start_height, row.tx_count]);
            this.prepareChartOptions(seriesData);
            this.isLoading = false;
            this.cd.markForCheck();
          }),
          map((response) => {
            const body: GogglesRollup[] = response.body || [];
            const headerCount = parseInt(response.headers.get('x-total-count'), 10);
            return {
              // fall back to a high value so the whole range selector stays available
              blockCount: Number.isFinite(headerCount) ? headerCount : Number.MAX_SAFE_INTEGER,
              txCount: body.reduce((acc, row) => acc + row.tx_count, 0),
            };
          }),
        );
      }),
      share(),
    );
  }

  prepareChartOptions(data): void {
    this.chartOptions = {
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
          let tooltip = `<b style="color: white; margin-left: 2px">` + $localize`Block: ${item.data[0]}` + `</b><br>`;
          tooltip += `${item.marker} ` + $localize`Transactions` + `: ${formatNumber(item.data[1], this.locale, '1.0-0')}<br>`;
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
