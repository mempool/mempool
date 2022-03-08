import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { EChartsOption, graphic } from 'echarts';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, map, startWith, switchMap, tap, toArray } from 'rxjs/operators';
import { BlockExtended, PoolStat } from 'src/app/interfaces/node-api.interface';
import { ApiService } from 'src/app/services/api.service';
import { StateService } from 'src/app/services/state.service';
import { selectPowerOfTen } from 'src/app/bitcoin.utils';
import { formatNumber } from '@angular/common';

@Component({
  selector: 'app-pool',
  templateUrl: './pool.component.html',
  styleUrls: ['./pool.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PoolComponent implements OnInit {
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  poolStats$: Observable<PoolStat>;
  blocks$: Observable<BlockExtended[]>;
  isLoading = true;

  radioGroupForm: FormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
    width: 'auto',
    height: 'auto',
  };

  fromHeight: number = -1;
  fromHeightSubject: BehaviorSubject<number> = new BehaviorSubject(this.fromHeight);

  blocks: BlockExtended[] = [];
  poolId: number = undefined;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private apiService: ApiService,
    private route: ActivatedRoute,
    public stateService: StateService,
    private formBuilder: FormBuilder,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: 'all' });
    this.radioGroupForm.controls.dateSpan.setValue('all');
  }

  ngOnInit(): void {
    this.poolStats$ = combineLatest([
      this.route.params.pipe(map((params) => params.poolId)),
      this.radioGroupForm.get('dateSpan').valueChanges.pipe(startWith('all')),
    ])
      .pipe(
        switchMap((params: any) => {
          this.poolId = params[0];
          return this.apiService.getPoolHashrate$(this.poolId, params[1] ?? 'all')
            .pipe(
              switchMap((data) => {
                this.prepareChartOptions(data.hashrates.map(val => [val.timestamp * 1000, val.avgHashrate]));
                return params;
              }),
              toArray(),
            )
        }),
        switchMap((params: any) => {
          if (this.blocks.length === 0) {
            this.fromHeightSubject.next(undefined);
          }
          return this.apiService.getPoolStats$(this.poolId, params[1] ?? '1w');
        }),
        map((poolStats) => {
          let regexes = '"';
          for (const regex of poolStats.pool.regexes) {
            regexes += regex + '", "';
          }
          poolStats.pool.regexes = regexes.slice(0, -3);
          poolStats.pool.addresses = poolStats.pool.addresses;

          this.isLoading = false;
          return Object.assign({
            logo: `./resources/mining-pools/` + poolStats.pool.name.toLowerCase().replace(' ', '').replace('.', '') + '.svg'
          }, poolStats);
        })
      );

    this.blocks$ = this.fromHeightSubject
      .pipe(
        distinctUntilChanged(),
        switchMap((fromHeight) => {
          return this.apiService.getPoolBlocks$(this.poolId, fromHeight);
        }),
        tap((newBlocks) => {
          this.blocks = this.blocks.concat(newBlocks);
        }),
        map(() => this.blocks)
      )
  }

  prepareChartOptions(data) {
    this.chartOptions = {
      animation: false,
      color: [
        new graphic.LinearGradient(0, 0, 0, 0.65, [
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
        formatter: function (data) {
          let hashratePowerOfTen: any = selectPowerOfTen(1);
          let hashrate = data[0].data[1];

          if (this.isMobile()) {
            hashratePowerOfTen = selectPowerOfTen(data[0].data[1]);
            hashrate = Math.round(data[0].data[1] / hashratePowerOfTen.divider);
          }

          return `
            <b style="color: white; margin-left: 18px">${data[0].axisValueLabel}</b><br>
            <span>${data[0].marker} ${data[0].seriesName}: ${formatNumber(hashrate, this.locale, '1.0-0')} ${hashratePowerOfTen.unit}H/s</span><br>
          `;
        }.bind(this)
      },
      xAxis: {
        type: 'time',
        splitNumber: (this.isMobile()) ? 5 : 10,
      },
      yAxis: [
        {
          min: function (value) {
            return value.min * 0.9;
          },
          type: 'value',
          name: 'Hashrate',
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
      series: [
        {
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
    };
  }

  isMobile() {
    return (window.innerWidth <= 767.98);
  }

  loadMore() {
    this.fromHeightSubject.next(this.blocks[this.blocks.length - 1]?.height);
  }

  trackByBlock(index: number, block: BlockExtended) {
    return block.height;
  }
}
