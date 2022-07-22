import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, OnInit, HostBinding } from '@angular/core';
import { EChartsOption} from 'echarts';
import { Observable } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { formatNumber } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';
import { StorageService } from 'src/app/services/storage.service';
import { MiningService } from 'src/app/services/mining.service';
import { download } from 'src/app/shared/graphs.utils';
import { SeoService } from 'src/app/services/seo.service';
import { LightningApiService } from '../lightning-api.service';

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
  @Input() left: number | string = 55;
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
    private miningService: MiningService
  ) {
  }

  ngOnInit(): void {
    let firstRun = true;

    if (this.widget) {
      this.miningWindowPreference = '1y';
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
                this.prepareChartOptions({
                  node_count: data.map(val => [val.added * 1000, val.node_count]), 
                  tor_nodes: data.map(val => [val.added * 1000, val.tor_nodes]),
                  clearnet_nodes: data.map(val => [val.added * 1000, val.clearnet_nodes]),
                  unannounced_nodes: data.map(val => [val.added * 1000, val.unannounced_nodes]),
                });
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

  prepareChartOptions(data) {
    let title: object;
    if (data.node_count.length === 0) {
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

    this.chartOptions = {
      title: title,
      animation: false,
      color: [
        '#D81B60',
        '#039BE5',
        '#7CB342',
        '#FFB300',
      ],
      grid: {
        top: 40,
        bottom: this.widget ? 30 : 70,
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
          const date = new Date(ticks[0].data[0]).toLocaleDateString(this.locale, { year: 'numeric', month: 'short', day: 'numeric' });
          let tooltip = `<b style="color: white; margin-left: 2px">${date}</b><br>`;

          for (const tick of ticks) {
            if (tick.seriesIndex === 0) { // Total
              tooltip += `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.0-0')}`;
            } else if (tick.seriesIndex === 1) { // Tor
              tooltip += `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.0-0')}`;
            } else if (tick.seriesIndex === 2) { // Clearnet
              tooltip += `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.0-0')}`;
            } else if (tick.seriesIndex === 3) { // Unannounced
              tooltip += `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.0-0')}`;
            }
            tooltip += `<br>`;
          }

          return tooltip;
        }
      },
      xAxis: data.node_count.length === 0 ? undefined : {
        type: 'time',
        splitNumber: (this.isMobile() || this.widget) ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      legend: data.node_count.length === 0 ? undefined : {
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
        selected: JSON.parse(this.storageService.getValue('nodes_networks_legend'))  ?? {
          'Total': true,
          'Tor': true,
          'Clearnet': true,
          'Unannounced': true,
        }
      },
      yAxis: data.node_count.length === 0 ? undefined : [
        {
          type: 'value',
          position: 'left',
          min: (value) => {
            return value.min * 0.9;
          },
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              return `${formatNumber(Math.round(val * 100) / 100, this.locale, '1.0-0')}`;
            }
          },
          splitLine: {
            lineStyle: {
              type: 'dotted',
              color: '#ffffff66',
              opacity: 0.25,
            }
          },
        }
      ],
      series: data.node_count.length === 0 ? [] : [
        {
          zlevel: 1,
          name: $localize`Total`,
          showSymbol: false,
          symbol: 'none',
          data: data.node_count,
          type: 'line',
          lineStyle: {
            width: 2,
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              type: 'solid',
              color: '#ffffff66',
              opacity: 1,
              width: 1,
            },
          },
          areaStyle: {
            opacity: 0.25,
          },
        },
        {
          zlevel: 1,
          yAxisIndex: 0,
          name: $localize`Tor`,
          showSymbol: false,
          symbol: 'none',
          data: data.tor_nodes,
          type: 'line',
          lineStyle: {
            width: 2,
          },
          areaStyle: {
            opacity: 0.25,
          },
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
            opacity: 0.25,
          },
        },
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
            opacity: 0.25,
          },
        } 
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

  onChartInit(ec) {
    if (this.chartInstance !== undefined) {
      return;
    }

    this.chartInstance = ec;

    this.chartInstance.on('legendselectchanged', (e) => {
      this.storageService.setValue('nodes_networks_legend', JSON.stringify(e.selected));
    });
  }

  isMobile() {
    return (window.innerWidth <= 767.98);
  }

  onSaveChart() {
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
