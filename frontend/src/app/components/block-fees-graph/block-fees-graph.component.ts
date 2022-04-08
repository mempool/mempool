import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { EChartsOption, graphic } from 'echarts';
import { Observable } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { formatNumber } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';
import { formatterXAxisLabel } from 'src/app/shared/graphs.utils';

@Component({
  selector: 'app-block-fees-graph',
  templateUrl: './block-fees-graph.component.html',
  styleUrls: ['./block-fees-graph.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 100;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockFeesGraphComponent implements OnInit {
  @Input() tableOnly = false;
  @Input() widget = false;
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  radioGroupForm: FormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  statsObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;
  timespan = '';

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: FormBuilder
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
  }

  ngOnInit(): void {
    if (!this.widget) {
      this.seoService.setTitle($localize`:@@mining.block-fees:Block Fees`);
    }

    this.statsObservable$ = this.radioGroupForm.get('dateSpan').valueChanges
      .pipe(
        startWith('1y'),
        switchMap((timespan) => {
          this.timespan = timespan;
          this.isLoading = true;
          return this.apiService.getHistoricalBlockFees$(timespan)
            .pipe(
              tap((data: any) => {
                this.prepareChartOptions({
                  blockFees: data.blockFees.map(val => [val.timestamp * 1000, val.avg_fees / 100000000]),
                });
                this.isLoading = false;
              }),
              map((data: any) => {
                const availableTimespanDay = (
                  (new Date().getTime() / 1000) - (data.oldestIndexedBlockTimestamp)
                ) / 3600 / 24;

                return {
                  availableTimespanDay: availableTimespanDay,
                };
              }),
            );
        }),
        share()
      );
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
      ],
      grid: {
        top: 30,
        bottom: 80,
        right: this.right,
        left: this.left,
      },
      tooltip: {
        show: !this.isMobile() || !this.widget,
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
        formatter: (ticks) => {
          const tick = ticks[0];
          const feesString = `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.3-3')} BTC`;
          return `
            <b style="color: white; margin-left: 18px">${tick.axisValueLabel}</b><br>
            <span>${feesString}</span>
          `;
        }
      },
      xAxis: {
        name: formatterXAxisLabel(this.locale, this.timespan),
        nameLocation: 'middle',
        nameTextStyle: {
          padding: [10, 0, 0, 0],
        },
        type: 'time',
        splitNumber: this.isMobile() ? 5 : 10,
      },
      yAxis: [
        {
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              return `${val} BTC`;
            }
          },
          splitLine: {
            show: false,
          }
        },
      ],
      series: [
        {
          zlevel: 0,
          name: 'Fees',
          showSymbol: false,
          symbol: 'none',
          data: data.blockFees,
          type: 'line',
          lineStyle: {
            width: 2,
          },
        },
      ],
      dataZoom: this.widget ? null : [{
        type: 'inside',
        realtime: true,
        zoomLock: true,
        maxSpan: 100,
        minSpan: 10,
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

  isMobile() {
    return (window.innerWidth <= 767.98);
  }
}
