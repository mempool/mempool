import { Component, Inject, Input, LOCALE_ID, OnInit, HostBinding } from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';
import { Observable } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { formatNumber } from '@angular/common';
import { UntypedFormGroup } from '@angular/forms';
import { StorageService } from '@app/services/storage.service';
import { download } from '@app/shared/graphs.utils';
import { LightningApiService } from '@app/lightning/lightning-api.service';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-node-statistics-chart',
  templateUrl: './node-statistics-chart.component.html',
  styleUrls: ['./node-statistics-chart.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 99;
    }
  `],
})
export class NodeStatisticsChartComponent implements OnInit {
  @Input() publicKey: string;
  @Input() right: number | string = 65;
  @Input() left: number | string = 45;
  @Input() widget = false;

  miningWindowPreference: string;
  radioGroupForm: UntypedFormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  @HostBinding('attr.dir') dir = 'ltr';

  blockSizesWeightsObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;
  timespan = '';
  chartInstance: any = undefined;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private lightningApiService: LightningApiService,
    private storageService: StorageService,
    public stateService: StateService,
    private activatedRoute: ActivatedRoute,
  ) {
  }

  ngOnInit(): void {

    this.activatedRoute.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.isLoading = true;
          return this.lightningApiService.listNodeStats$(params.get('public_key'))
            .pipe(
              tap((data) => {
                this.prepareChartOptions({
                  channels: data.map(val => [val.added * 1000, val.channels]),
                  capacity: data.map(val => [val.added * 1000, val.capacity]),
                });
                this.isLoading = false;
              }),
            );
        }),
      ).subscribe(() => {
      });
  }

  prepareChartOptions(data) {
    let title: object;
    if (data.channels.length < 2) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: $localize`No data to display yet. Try again later.`,
        left: 'center',
        top: 'center'
      };
    }

    this.chartOptions = {
      title: title,
      animation: false,
      color: [
        '#FDD835',
        '#D81B60',
      ],
      grid: {
        top: 30,
        bottom: 20,
        right: this.right,
        left: this.left,
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
        formatter: (ticks) => {
          let sizeString = '';
          let weightString = '';

          for (const tick of ticks) {
            if (tick.seriesIndex === 0) { // Channels
              sizeString = `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.0-0')}`;
            } else if (tick.seriesIndex === 1) { // Capacity
              weightString = `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1] / 100000000, this.locale, '1.0-0')} BTC`;
            }
          }

          const date = new Date(ticks[0].data[0]).toLocaleDateString(this.locale, { year: 'numeric', month: 'short', day: 'numeric' });

          const tooltip = `<b style="color: white; margin-left: 18px">${date}</b><br>
            <span>${sizeString}</span><br>
            <span>${weightString}</span>`;

          return tooltip;
        }
      },
      xAxis: data.channels.length < 2 ? undefined : {
        type: 'time',
        splitNumber: this.isMobile() ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      legend: data.channels.length < 2 ? undefined : {
        padding: 10,
        data: [
          {
            name: $localize`:@@807cf11e6ac1cde912496f764c176bdfdd6b7e19:Channels`,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: $localize`:@@ce9dfdc6dccb28dc75a78c704e09dc18fb02dcfa:Capacity`,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
        ],
        selected: JSON.parse(this.storageService.getValue('sizes_ln_legend'))  ?? {
          'Channels': true,
          'Capacity': true,
        }
      },
      yAxis: data.channels.length < 2 ? undefined : [
        {
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              return `${Math.round(val)}`;
            }
          },
          splitLine: {
            lineStyle: {
              type: 'dotted',
              color: 'var(--transparent-fg)',
              opacity: 0.25,
            }
          },
        },
        {
          type: 'value',
          position: 'right',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              return `${val / 100000000} BTC`;
            }
          },
          splitLine: {
            show: false,
          }
        }
      ],
      series: data.channels.length < 2 ? [] : [
        {
          zlevel: 1,
          name: $localize`:@@807cf11e6ac1cde912496f764c176bdfdd6b7e19:Channels`,
          showSymbol: false,
          symbol: 'none',
          data: data.channels,
          type: 'line',
          step: 'middle',
          lineStyle: {
            width: 2,
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              type: 'solid',
              color: 'var(--transparent-fg)',
              opacity: 1,
              width: 1,
            },
          }
        },
        {
          zlevel: 0,
          yAxisIndex: 1,
          name: $localize`:@@ce9dfdc6dccb28dc75a78c704e09dc18fb02dcfa:Capacity`,
          showSymbol: false,
          symbol: 'none',
          stack: 'Total',
          data: data.capacity,
          areaStyle: {},
          type: 'line',
          step: 'middle',
        }
      ],
    };
  }

  onChartInit(ec) {
    if (this.chartInstance !== undefined) {
      return;
    }

    this.chartInstance = ec;

    this.chartInstance.on('legendselectchanged', (e) => {
      this.storageService.setValue('sizes_ln_legend', JSON.stringify(e.selected));
    });
  }

  isMobile() {
    return (window.innerWidth <= 767.98);
  }
}
