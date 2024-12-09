import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, NgZone, OnInit } from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';
import { Observable } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { download, formatterXAxis, formatterXAxisLabel, formatterXAxisTimeCategory } from '@app/shared/graphs.utils';
import { StorageService } from '@app/services/storage.service';
import { ActivatedRoute, Router } from '@angular/router';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-block-health-graph',
  templateUrl: './block-health-graph.component.html',
  styleUrls: ['./block-health-graph.component.scss'],
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
export class BlockHealthGraphComponent implements OnInit {
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
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: UntypedFormBuilder,
    private storageService: StorageService,
    private zone: NgZone,
    private route: ActivatedRoute,
    public stateService: StateService,
    private router: Router,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@b1fa5b210c9670d49a6506f046d4a0c2797fd402:Block Health`);
    this.seoService.setDescription($localize`:@@meta.description.bitcoin.graphs.block-health:See Bitcoin block health visualized over time. Block health is a measure of how many expected transactions were included in an actual mined block. Expected transactions are determined using Mempool's re-implementation of Bitcoin Core's transaction selection algorithm.`);
    this.miningWindowPreference = '24h';//this.miningService.getDefaultTimespan('24h');
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.route
      .fragment
      .subscribe((fragment) => {
        if (['24h', '3d', '1w', '1m', '3m', '6m', '1y', '2y', '3y', 'all'].indexOf(fragment) > -1) {
          this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
        }
      });

    this.statsObservable$ = this.radioGroupForm.get('dateSpan').valueChanges
      .pipe(
        startWith(this.radioGroupForm.controls.dateSpan.value),
        switchMap((timespan) => {
          this.storageService.setValue('miningWindowPreference', timespan);
          this.timespan = timespan;
          this.isLoading = true;
          return this.apiService.getHistoricalBlocksHealth$(timespan)
            .pipe(
              tap((response) => {
                this.prepareChartOptions(response.body);
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
    if (data.length === 0) {
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
      title: data.length === 0 ? title : undefined,
      animation: false,
      grid: {
        top: 30,
        bottom: 80,
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
          let tooltip = `<b style="color: white; margin-left: 2px">${formatterXAxis(this.locale, this.timespan, parseInt(ticks[0].axisValue, 10) * 1000)}</b><br>`;
          tooltip += `${ticks[0].marker} ${ticks[0].seriesName}: ${formatNumber(ticks[0].data.value, this.locale, '1.2-2')}%<br>`;

          if (['24h', '3d'].includes(this.timespan)) {
            tooltip += `<small>` + $localize`At block: ${ticks[0].data.block}` + `</small>`;
          } else {
            tooltip += `<small>` + $localize`Around block: ${ticks[0].data.block}` + `</small>`;
          }

          return tooltip;
        }
      },
      xAxis: data.length === 0 ? undefined : {
        name: formatterXAxisLabel(this.locale, this.timespan),
        nameLocation: 'middle',
        nameTextStyle: {
          padding: [10, 0, 0, 0],
        },
        type: 'category',
        axisLine: { onZero: true },
        axisLabel: {
          formatter: val => formatterXAxisTimeCategory(this.locale, this.timespan, parseInt(val, 10) * 1000),
          align: 'center',
          fontSize: 11,
          lineHeight: 12,
          hideOverlap: true,
          padding: [0, 5],
        },
        data: data.map(health => health[0])
      },
      yAxis: data.length === 0 ? undefined : [
        {
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              return `${val}%`;
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
      ],
      series: data.length === 0 ? undefined : [
        {
          zlevel: 0,
          name: $localize`:@@d2bcd3296d2850de762fb943060b7e086a893181:Health`,
          data: data.map(health => ({
            value: health[2],
            block: health[1],
            itemStyle: {
              color: this.getHealthColor(health[2])
            }
          })),
          type: 'bar',
          barWidth: '90%',
          barMaxWidth: 50,
        },
      ],
      dataZoom: data.length === 0 ? undefined : [{
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

  colorGradient(fadeFraction, rgbColor1, rgbColor2, rgbColor3) {
    let color1 = rgbColor1;
    let color2 = rgbColor2;
    let fade = fadeFraction;

    // Do we have 3 colors for the gradient? Need to adjust the params.
    if (rgbColor3) {
      fade = fade * 2;

      // Find which interval to use and adjust the fade percentage
      if (fade >= 1) {
        fade -= 1;
        color1 = rgbColor2;
        color2 = rgbColor3;
      }
    }

    const diffRed = color2.red - color1.red;
    const diffGreen = color2.green - color1.green;
    const diffBlue = color2.blue - color1.blue;

    const gradient = {
      red: Math.floor(color1.red + (diffRed * fade)),
      green: Math.floor(color1.green + (diffGreen * fade)),
      blue: Math.floor(color1.blue + (diffBlue * fade)),
    };

    return 'rgb(' + gradient.red + ',' + gradient.green + ',' + gradient.blue + ')';
  }

  getHealthColor(matchRate) {
    return this.colorGradient(
      Math.pow((100 - matchRate) / 100, 0.5),
      {red: 67, green: 171, blue: 71},
      {red: 253, green: 216, blue: 53},
      {red: 244, green: 0, blue: 0},
    );
  }

  onChartInit(ec) {
    this.chartInstance = ec;

    this.chartInstance.on('click', (e) => {
      this.zone.run(() => {
        if (['24h', '3d'].includes(this.timespan)) {
          const url = new RelativeUrlPipe(this.stateService).transform(`/block/${e.data.block}`);
          this.router.navigate([url]);
        }
      });
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
    this.chartOptions.backgroundColor = 'var(--active-bg)';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `block-health-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
