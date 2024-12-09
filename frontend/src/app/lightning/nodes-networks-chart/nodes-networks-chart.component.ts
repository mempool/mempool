import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, OnInit, HostBinding, OnChanges, SimpleChanges } from '@angular/core';
import { echarts, EChartsOption, LineSeriesOption } from '@app/graphs/echarts';
import { Observable } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { StorageService } from '@app/services/storage.service';
import { MiningService } from '@app/services/mining.service';
import { download } from '@app/shared/graphs.utils';
import { SeoService } from '@app/services/seo.service';
import { LightningApiService } from '@app/lightning/lightning-api.service';
import { AmountShortenerPipe } from '@app/shared/pipes/amount-shortener.pipe';
import { isMobile } from '@app/shared/common.utils';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-nodes-networks-chart',
  templateUrl: './nodes-networks-chart.component.html',
  styleUrls: ['./nodes-networks-chart.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 99;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesNetworksChartComponent implements OnInit, OnChanges {
  @Input() height: number = 150;
  @Input() right: number | string = 45;
  @Input() left: number | string = 45;
  @Input() widget = false;

  miningWindowPreference: string;
  radioGroupForm: UntypedFormGroup;

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

  chartData: any;
  maxYAxis: number;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private lightningApiService: LightningApiService,
    private formBuilder: UntypedFormBuilder,
    private storageService: StorageService,
    private miningService: MiningService,
    public stateService: StateService,
    private amountShortenerPipe: AmountShortenerPipe,
  ) {
  }

  ngOnInit(): void {
    let firstRun = true;

    if (this.widget) {
      this.miningWindowPreference = '3y';
    } else {
      this.seoService.setTitle($localize`:@@b420668a91f8ebaf6e6409c4ba87f1d45961d2bd:Lightning Nodes Per Network`);
      this.seoService.setDescription($localize`:@@meta.description.lightning.nodes-network:See the number of Lightning network nodes visualized over time by network: clearnet only (IPv4, IPv6), darknet (Tor, I2p, cjdns), and both.`);
      this.miningWindowPreference = this.miningService.getDefaultTimespan('all');
    }
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.nodesNetworkObservable$ = this.radioGroupForm.get('dateSpan').valueChanges.pipe(
      startWith(this.miningWindowPreference),
      switchMap((timespan) => {
        this.timespan = timespan;
        if (!this.widget && !firstRun) {
          this.storageService.setValue('lightningWindowPreference', timespan);
        }
        firstRun = false;
        this.miningWindowPreference = timespan;
        this.isLoading = true;
        return this.lightningApiService.cachedRequest(this.lightningApiService.listStatistics$, 250, timespan)
          .pipe(
            tap((response:any) => {
              const data = response.body;
              this.chartData = {
                tor_nodes: data.map(val => [val.added * 1000, val.tor_nodes]),
                clearnet_nodes: data.map(val => [val.added * 1000, val.clearnet_nodes]),
                unannounced_nodes: data.map(val => [val.added * 1000, val.unannounced_nodes]),
                clearnet_tor_nodes: data.map(val => [val.added * 1000, val.clearnet_tor_nodes]),
              };
              this.maxYAxis = 0;
              for (const day of data) {
                this.maxYAxis = Math.max(this.maxYAxis, day.tor_nodes + day.clearnet_nodes + day.unannounced_nodes + day.clearnet_tor_nodes);
              }
              this.maxYAxis = Math.ceil(this.maxYAxis / 3000) * 3000;
              this.prepareChartOptions(this.chartData, this.maxYAxis);
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.height && this.chartData && this.maxYAxis != null) {
      this.prepareChartOptions(this.chartData, this.maxYAxis);
    }
  }

  prepareChartOptions(data, maxYAxis): void {
    let title: object;
    if (!this.widget && data.tor_nodes.length === 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: $localize`Indexing in progress`,
        left: 'center',
        top: 'center',
      };
    } else if (this.widget && data.tor_nodes.length > 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 11
        },
        text: $localize`:@@b420668a91f8ebaf6e6409c4ba87f1d45961d2bd:Lightning Nodes Per Network`,
        left: 'center',
        top: 0,
        zlevel: 10,
      };
    }

    const series: LineSeriesOption[] = [
      {
        zlevel: 1,
        yAxisIndex: 0,
        name: $localize`:@@e5d8bb389c702588877f039d72178f219453a72d:Unknown`,
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
        color: new echarts.graphic.LinearGradient(0, 0.75, 0, 1, [
          { offset: 0, color: '#D81B60' },
          { offset: 1, color: '#D81B60AA' },
        ]),

        smooth: false,
      },
      {
        zlevel: 1,
        yAxisIndex: 0,
        name: $localize`Clearnet and Darknet`,
        showSymbol: false,
        symbol: 'none',
        data: data.clearnet_tor_nodes,
        type: 'line',
        lineStyle: {
          width: 2,
        },
        areaStyle: {
          opacity: 0.5,
        },
        stack: 'Total',
        color: new echarts.graphic.LinearGradient(0, 0.75, 0, 1, [
          { offset: 0, color: '#be7d4c' },
          { offset: 1, color: '#be7d4cAA' },
        ]),
        smooth: false,
      },
      {
        zlevel: 1,
        yAxisIndex: 0,
        name: $localize`Clearnet Only (IPv4, IPv6)`,
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
        color: new echarts.graphic.LinearGradient(0, 0.75, 0, 1, [
          { offset: 0, color: '#FFB300' },
          { offset: 1, color: '#FFB300AA' },
        ]),
        smooth: false,
      },
      {
        zlevel: 1,
        yAxisIndex: 0,
        name: $localize`Darknet Only (Tor, I2P, cjdns)`,
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
        color: new echarts.graphic.LinearGradient(0, 0.75, 0, 1, [
          { offset: 0, color: '#7D4698' },
          { offset: 1, color: '#7D4698AA' },
        ]),
        smooth: false,
      },
    ];

    this.chartOptions = {
      title: title,
      animation: false,
      grid: {
        height: this.widget ? ((this.height || 120) - 60) : undefined,
        top: this.widget ? 20 : 40,
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
          color: 'var(--tooltip-grey)',
          align: 'left',
        },
        borderColor: '#000',
        formatter: (ticks): string => {
          let total = 0;
          const date = new Date(ticks[0].data[0]).toLocaleDateString(this.locale, { year: 'numeric', month: 'short', day: 'numeric' });
          let tooltip = `<b style="color: white; margin-left: 2px">${date}</b><br>`;

          for (const tick of ticks.reverse()) {
            if (tick.seriesName.indexOf('ignored') !== -1) {
              continue;
            }
            if (tick.seriesIndex === 0) { // Tor
              tooltip += `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.0-0')}`;
            } else if (tick.seriesIndex === 1) { // Clearnet
              tooltip += `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.0-0')}`;
            } else if (tick.seriesIndex === 2) { // Unannounced
              tooltip += `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.0-0')}`;
            } else if (tick.seriesIndex === 3) { // Tor + Clearnet
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
            name: $localize`Darknet Only (Tor, I2P, cjdns)`,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: $localize`Clearnet Only (IPv4, IPv6)`,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: $localize`Clearnet and Darknet`,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: $localize`:@@e5d8bb389c702588877f039d72178f219453a72d:Unknown`,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
        ],
        selected: this.widget ? undefined : JSON.parse(this.storageService.getValue('nodes_networks_legend'))  ?? {
          '$localize`Darknet Only (Tor, I2P, cjdns)`': true,
          '$localize`Clearnet Only (IPv4, IPv6)`': true,
          '$localize`Clearnet and Darknet`': true,
          '$localize`:@@e5d8bb389c702588877f039d72178f219453a72d:Unknown`': true,
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
              color: 'var(--transparent-fg)',
              opacity: 0.25,
            },
          },
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
              color: 'var(--transparent-fg)',
              opacity: 0.25,
            },
          },
          min: 0,
          interval: 3000,
        }
      ],
      series: data.tor_nodes.length === 0 ? [] : series.concat(series.map((serie) => {
        // We create dummy duplicated series so when we use the data zoom, the y axis
        // both scales properly
        const invisibleSerie = {...serie};
        invisibleSerie.name = 'ignored' + Math.random().toString();
        invisibleSerie.stack = 'ignored';
        invisibleSerie.yAxisIndex = 1;
        invisibleSerie.lineStyle = {
          opacity: 0,
        };
        invisibleSerie.areaStyle = {
          opacity: 0,
        };
        return invisibleSerie;
      })),
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

    if (isMobile() && this.chartOptions.legend) {
      // @ts-ignore
      this.chartOptions.legend.left = 50;
    }
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
    this.chartOptions.backgroundColor = 'var(--active-bg)';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `lightning-nodes-per-network-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
