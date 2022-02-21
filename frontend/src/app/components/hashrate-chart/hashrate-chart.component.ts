import { Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { EChartsOption } from 'echarts';
import { Observable } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { formatNumber } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';
import { selectPowerOfTen } from 'src/app/bitcoin.utils';

@Component({
  selector: 'app-hashrate-chart',
  templateUrl: './hashrate-chart.component.html',
  styleUrls: ['./hashrate-chart.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 38%;
      left: calc(50% - 15px);
      z-index: 100;
    }
  `],
})
export class HashrateChartComponent implements OnInit {
  @Input() widget: boolean = false;
  @Input() right: number | string = 10;
  @Input() left: number | string = 75;

  radioGroupForm: FormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
    width: 'auto',
    height: 'auto',
  };

  hashrateObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: FormBuilder,
  ) {
    this.seoService.setTitle($localize`:@@mining.hashrate:hashrate`);
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
  }

  ngOnInit(): void {
    this.hashrateObservable$ = this.radioGroupForm.get('dateSpan').valueChanges
      .pipe(
        startWith('1y'),
        switchMap((timespan) => {
          return this.apiService.getHistoricalHashrate$(timespan)
            .pipe(
              tap(data => {
                this.prepareChartOptions(data.hashrates.map(val => [val.timestamp * 1000, val.avgHashrate]));
                this.isLoading = false;
              }),
              map(data => {
                const availableTimespanDay = (
                  (new Date().getTime() / 1000) - (data.oldestIndexedBlockTimestamp / 1000)
                ) / 3600 / 24;
                return {
                  availableTimespanDay: availableTimespanDay,
                  data: data.hashrates
                };
              }),
            );
        }),
        share()
      );
  }

  prepareChartOptions(data) {
    this.chartOptions = {
      grid: {
        right: this.right,
        left: this.left,
      },
      title: {
        text: this.widget ? '' : $localize`:@@mining.hashrate:Hashrate`,
        left: 'center',
        textStyle: {
          color: '#FFF',
        },
      },
      tooltip: {
        show: true,
        trigger: 'axis',
      },
      axisPointer: {
        type: 'line',
      },
      xAxis: {
        type: 'time',
        splitNumber: this.isMobile() ? 5 : 10,
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (val) => {
            const selectedPowerOfTen: any = selectPowerOfTen(val);
            const newVal = val / selectedPowerOfTen.divider;
            return `${newVal} ${selectedPowerOfTen.unit}H/s`
          }
        },
        splitLine: {
          lineStyle: {
            type: 'dotted',
            color: '#ffffff66',
            opacity: 0.25,
          }
        },
      },
      series: {
        showSymbol: false,
        data: data,
        type: 'line',
        smooth: false,
        lineStyle: {
          width: 2,
        },
        areaStyle: {
          opacity: 0.25
        },
      },
      dataZoom: this.widget ? null : [{
        type: 'inside',
        realtime: true,
        zoomLock: true,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        maxSpan: 100,
        minSpan: 10,
      }, {
        showDetail: false,
        show: true,
        type: 'slider',
        brushSelect: false,
        realtime: true,
        bottom: 0,
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
