import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, OnInit, HostBinding, NgZone } from '@angular/core';
import { EChartsOption} from 'echarts';
import { Observable } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { formatNumber } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';
import { StorageService } from 'src/app/services/storage.service';
import { MiningService } from 'src/app/services/mining.service';
import { StateService } from 'src/app/services/state.service';
import { Router } from '@angular/router';
import { download } from 'src/app/shared/graphs.utils';

@Component({
  selector: 'app-block-sizes-weights-graph',
  templateUrl: './block-sizes-weights-graph.component.html',
  styleUrls: ['./block-sizes-weights-graph.component.scss'],
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
export class BlockSizesWeightsGraphComponent implements OnInit {
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  miningWindowPreference: string;
  radioGroupForm: FormGroup;

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
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: FormBuilder,
    private storageService: StorageService,
    private miningService: MiningService,
    private stateService: StateService,
    private router: Router,
    private zone: NgZone,
  ) {
  }

  ngOnInit(): void {
    let firstRun = true;

    this.seoService.setTitle($localize`:@@56fa1cd221491b6478998679cba2dc8d55ba330d:Block Sizes and Weights`);
    this.miningWindowPreference = this.miningService.getDefaultTimespan('24h');
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.blockSizesWeightsObservable$ = this.radioGroupForm.get('dateSpan').valueChanges
      .pipe(
        startWith(this.miningWindowPreference),
        switchMap((timespan) => {
          this.timespan = timespan;
          if (!firstRun) {
            this.storageService.setValue('miningWindowPreference', timespan);
          }
          firstRun = false;
          this.miningWindowPreference = timespan;
          this.isLoading = true;
          return this.apiService.getHistoricalBlockSizesAndWeights$(timespan)
            .pipe(
              tap((response) => {
                const data = response.body;
                this.prepareChartOptions({
                  sizes: data.sizes.map(val => [val.timestamp * 1000, val.avg_size / 1000000, val.avg_height]),
                  weights: data.weights.map(val => [val.timestamp * 1000, val.avg_weight / 1000000, val.avg_height]),
                });
                this.isLoading = false;
              }),
              map((response) => {
                return {
                  blockCount: parseInt(response.headers.get('x-total-count'), 10),
                };
              }),
            );
        }),
        share()
      );
  }

  prepareChartOptions(data) {
    let title: object;
    if (data.sizes.length === 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: `Indexing in progess`,
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
        bottom: 70,
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
          color: '#b1b1b1',
          align: 'left',
        },
        borderColor: '#000',
        formatter: (ticks) => {
          let sizeString = '';
          let weightString = '';

          for (const tick of ticks) {
            if (tick.seriesIndex === 0) { // Size
              sizeString = `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.2-2')} MB`;
            } else if (tick.seriesIndex === 1) { // Weight
              weightString = `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.2-2')} MWU`;
            }
          }

          const date = new Date(ticks[0].data[0]).toLocaleDateString(this.locale, { year: 'numeric', month: 'short', day: 'numeric' });

          let tooltip = `<b style="color: white; margin-left: 18px">${date}</b><br>
            <span>${sizeString}</span><br>
            <span>${weightString}</span>`;

          if (['24h', '3d'].includes(this.timespan)) {
            tooltip += `<br><small>At block: ${ticks[0].data[2]}</small>`;
          } else {
            tooltip += `<br><small>Around block ${ticks[0].data[2]}</small>`;
          }

          return tooltip;
        }
      },
      xAxis: data.sizes.length === 0 ? undefined : {
        type: 'time',
        splitNumber: this.isMobile() ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      legend: data.sizes.length === 0 ? undefined : {
        padding: 10,
        data: [
          {
            name: 'Size',
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: 'Weight',
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
        ],
        selected: JSON.parse(this.storageService.getValue('sizes_weights_legend'))  ?? {
          'Size': true,
          'Weight': true,
        }
      },
      yAxis: data.sizes.length === 0 ? undefined : [
        {
          type: 'value',
          position: 'left',
          min: (value) => {
            return value.min * 0.9;
          },
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              return `${Math.round(val * 100) / 100} MWU`;
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
      series: data.sizes.length === 0 ? [] : [
        {
          zlevel: 1,
          name: 'Size',
          showSymbol: false,
          symbol: 'none',
          data: data.sizes,
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
            data: [{
              yAxis: 1,
              label: {
                position: 'end',
                show: true,
                color: '#ffffff',
                formatter: `1 MB`
              }
            }],
          }
        },
        {
          zlevel: 1,
          yAxisIndex: 0,
          name: 'Weight',
          showSymbol: false,
          symbol: 'none',
          data: data.weights,
          type: 'line',
          lineStyle: {
            width: 2,
          }
        }
      ],
      dataZoom: [{
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
      this.storageService.setValue('sizes_weights_legend', JSON.stringify(e.selected));
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
