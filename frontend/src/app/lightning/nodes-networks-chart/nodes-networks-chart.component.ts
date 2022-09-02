import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, OnInit, HostBinding } from '@angular/core';
import { EChartsOption, graphic} from 'echarts';
import { Observable } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { formatNumber } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';
import { StorageService } from 'src/app/services/storage.service';
import { MiningService } from 'src/app/services/mining.service';
import { download } from 'src/app/shared/graphs.utils';
import { SeoService } from 'src/app/services/seo.service';
import { LightningApiService } from '../lightning-api.service';
import { AmountShortenerPipe } from 'src/app/shared/pipes/amount-shortener.pipe';
import { isMobile } from 'src/app/shared/common.utils';

@Component({
  selector: 'app-nodes-networks-chart',
  templateUrl: './nodes-networks-chart.component.html',
  styleUrls: ['./nodes-networks-chart.component.scss'],
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
export class NodesNetworksChartComponent implements OnInit {
  @Input() right: number | string = 45;
  @Input() left: number | string = 45;
  @Input() widget = false;

  miningWindowPreference: string;
  radioGroupForm: FormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  @HostBinding('attr.dir') dir = 'ltr';

  nodesNetworkObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;
  timespan = '';
  chartInstance: any = undefined;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private lightningApiService: LightningApiService,
    private formBuilder: FormBuilder,
    private storageService: StorageService,
    private miningService: MiningService,
    private amountShortenerPipe: AmountShortenerPipe,
  ) {
  }

  ngOnInit(): void {
    let firstRun = true;

    if (this.widget) {
      this.miningWindowPreference = '3y';
    } else {
      this.seoService.setTitle($localize`Lightning nodes per network`);
      this.miningWindowPreference = this.miningService.getDefaultTimespan('all');
    }
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.nodesNetworkObservable$ = this.radioGroupForm.get('dateSpan').valueChanges
      .pipe(
        startWith(this.miningWindowPreference),
        switchMap((timespan) => {
          this.timespan = timespan;
          if (!this.widget && !firstRun) {
            this.storageService.setValue('lightningWindowPreference', timespan);
          }
          firstRun = false;
          this.miningWindowPreference = timespan;
          this.isLoading = true;
          return this.lightningApiService.listStatistics$(timespan)
            .pipe(
              tap((response) => {
                const data = response.body;
                const chartData = {
                  tor_nodes: data.map(val => [val.added * 1000, val.tor_nodes]),
                  clearnet_nodes: data.map(val => [val.added * 1000, val.clearnet_nodes]),
                  unannounced_nodes: data.map(val => [val.added * 1000, val.unannounced_nodes]),
                };
                let maxYAxis = 0;
                for (const day of data) {
                  maxYAxis = Math.max(maxYAxis, day.tor_nodes + day.clearnet_nodes + day.unannounced_nodes);
                }
                maxYAxis = Math.ceil(maxYAxis / 3000) * 3000;
                this.prepareChartOptions(chartData, maxYAxis);
                this.isLoading = false;
              }),
              map((response) => {
                return {
                  days: parseInt(response.headers.get('x-total-count'), 10),
                };
              }),
            );
        }),
        share()
      );
  }

  prepareChartOptions(data, maxYAxis): void {
    let title: object;
    if (!this.widget && data.tor_nodes.length === 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: $localize`Indexing in progess`,
        left: 'center',
        top: 'center',
      };
    } else if (this.widget && data.tor_nodes.length > 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 11
        },
        text: $localize`Nodes per network`,
        left: 'center',
        top: 11,
        zlevel: 10,
      };
    }

    this.chartOptions = {
      title: title,
      animation: false,
      grid: {
        height: this.widget ? 100 : undefined,
        top: this.widget ? 10 : 40,
        bottom: this.widget ? 0 : 70,
        right: (isMobile() && this.widget) ? 35 : this.right,
        left: (isMobile() && this.widget) ? 40 :this.left,
      },
      tooltip: {
        show: !isMobile() || !this.widget,
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
        formatter: (ticks): string => {
          let total = 0;
          const date = new Date(ticks[0].data[0]).toLocaleDateString(this.locale, { year: 'numeric', month: 'short', day: 'numeric' });
          let tooltip = `<b style="color: white; margin-left: 2px">${date}</b><br>`;

          for (const tick of ticks.reverse()) {
            if (tick.seriesIndex === 0) { // Tor
              tooltip += `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.0-0')}`;
            } else if (tick.seriesIndex === 1) { // Clearnet
              tooltip += `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.0-0')}`;
            } else if (tick.seriesIndex === 2) { // Unannounced
              tooltip += `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.0-0')}`;
            }
            tooltip += `<br>`;
            total += tick.data[1];
          }
          tooltip += `<b>Total:</b> ${formatNumber(total, this.locale, '1.0-0')} nodes`;

          return tooltip;
        }
      },
      xAxis: data.tor_nodes.length === 0 ? undefined : {
        type: 'time',
        splitNumber: (isMobile() || this.widget) ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      legend: this.widget || data.tor_nodes.length === 0 ? undefined : {
        padding: 10,
        data: [
          {
            name: $localize`Total`,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: $localize`Tor`,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: $localize`Clearnet`,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: $localize`Unannounced`,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
        ],
        selected: this.widget ? undefined : JSON.parse(this.storageService.getValue('nodes_networks_legend'))  ?? {
          'Total': true,
          'Tor': true,
          'Clearnet': true,
          'Unannounced': true,
        }
      },
      yAxis: data.tor_nodes.length === 0 ? undefined : [
        {
          type: 'value',
          position: 'left',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val: number): string => {
              if (this.widget) {
                return `${this.amountShortenerPipe.transform(val, 0)}`;
              } else {
                return `${formatNumber(Math.round(val), this.locale, '1.0-0')}`;
              }
            }
          },
          splitLine: {
            lineStyle: {
              type: 'dotted',
              color: '#ffffff66',
              opacity: 0.25,
            },
          },
          max: maxYAxis,
          min: 0,
          interval: 3000,
        },
        {
          type: 'value',
          position: 'right',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val: number): string => {
              if (this.widget) {
                return `${this.amountShortenerPipe.transform(val, 0)}`;
              } else {
                return `${formatNumber(Math.round(val), this.locale, '1.0-0')}`;
              }
            }
          },
          splitLine: {
            lineStyle: {
              type: 'dotted',
              color: '#ffffff66',
              opacity: 0.25,
            },
          },
          max: maxYAxis,
          min: 0,
          interval: 3000,
        }
      ],
      series: data.tor_nodes.length === 0 ? [] : [
        {
          zlevel: 1,
          yAxisIndex: 0,
          name: $localize`Unannounced`,
          showSymbol: false,
          symbol: 'none',
          data: data.unannounced_nodes,
          type: 'line',
          lineStyle: {
            width: 2,
          },
          areaStyle: {
            opacity: 0.5,
          },
          stack: 'Total',
          color: new graphic.LinearGradient(0, 0.75, 0, 1, [
            { offset: 0, color: '#D81B60' },
            { offset: 1, color: '#D81B60AA' },
          ]),

          smooth: false,
        },
        {
          zlevel: 1,
          yAxisIndex: 0,
          name: $localize`Clearnet`,
          showSymbol: false,
          symbol: 'none',
          data: data.clearnet_nodes,
          type: 'line',
          lineStyle: {
            width: 2,
          },
          areaStyle: {
            opacity: 0.5,
          },
          stack: 'Total',
          color: new graphic.LinearGradient(0, 0.75, 0, 1, [
            { offset: 0, color: '#FFB300' },
            { offset: 1, color: '#FFB300AA' },
          ]),
          smooth: false,
        },
        {
          zlevel: 1,
          yAxisIndex: 1,
          name: $localize`Tor`,
          showSymbol: false,
          symbol: 'none',
          data: data.tor_nodes,
          type: 'line',
          lineStyle: {
            width: 2,
          },
          areaStyle: {
            opacity: 0.5,
          },
          stack: 'Total',
          color: new graphic.LinearGradient(0, 0.75, 0, 1, [
            { offset: 0, color: '#7D4698' },
            { offset: 1, color: '#7D4698AA' },
          ]),
          smooth: false,
        },
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

    this.chartInstance.on('legendselectchanged', (e) => {
      this.storageService.setValue('nodes_networks_legend', JSON.stringify(e.selected));
    });
  }

  onSaveChart(): void {
    // @ts-ignore
    const prevBottom = this.chartOptions.grid.bottom;
    const now = new Date();
    // @ts-ignore
    this.chartOptions.grid.bottom = 40;
    this.chartOptions.backgroundColor = '#11131f';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `block-sizes-weights-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
