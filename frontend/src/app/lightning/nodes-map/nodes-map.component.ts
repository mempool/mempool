import { ChangeDetectionStrategy, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { mempoolFeeColors } from 'src/app/app.constants';
import { SeoService } from 'src/app/services/seo.service';
import { ApiService } from 'src/app/services/api.service';
import { combineLatest, Observable, tap } from 'rxjs';
import { AssetsService } from 'src/app/services/assets.service';
import { EChartsOption, MapSeriesOption, registerMap } from 'echarts';
import { download } from 'src/app/shared/graphs.utils';
import { Router } from '@angular/router';
import { RelativeUrlPipe } from 'src/app/shared/pipes/relative-url/relative-url.pipe';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-nodes-map',
  templateUrl: './nodes-map.component.html',
  styleUrls: ['./nodes-map.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesMap implements OnInit, OnDestroy {
  observable$: Observable<any>;

  chartInstance = undefined;
  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  constructor(
    private seoService: SeoService,
    private apiService: ApiService,
    private stateService: StateService,
    private assetsService: AssetsService,
    private router: Router,
    private zone: NgZone,
  ) {
  }

  ngOnDestroy(): void {}

  ngOnInit(): void {
    this.seoService.setTitle($localize`Lightning nodes world map`);

    this.observable$ = combineLatest([
      this.assetsService.getWorldMapJson$,
      this.apiService.getNodesPerCountry()
    ]).pipe(tap((data) => {
      registerMap('world', data[0]);

      const countries = [];
      let max = 0;
      for (const country of data[1]) {
        countries.push({
          name: country.name.en,
          value: country.count,
          iso: country.iso.toLowerCase(),
        });
        max = Math.max(max, country.count);
      }

      this.prepareChartOptions(countries, max);
    }));
  }

  prepareChartOptions(countries, max) {
    let title: object;
    if (countries.length === 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: $localize`No data to display yet`,
        left: 'center',
        top: 'center'
      };
    }

    this.chartOptions = {
      title: countries.length === 0 ? title : undefined,
      tooltip: {
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: '#b1b1b1',
        },
        borderColor: '#000',
        formatter: function(country) {
          if (country.data === undefined) { 
            return `<b style="color: white">${country.name}<br>0 nodes</b><br>`;
          } else {
            return `<b style="color: white">${country.data.name}<br>${country.data.value} nodes</b><br>`;
          }
        }
      },
      visualMap: {
        left: 'right',
        show: true,
        min: 1,
        max: max,
        text: ['High', 'Low'],
        calculable: true,        
        textStyle: {
          color: 'white',
        },
        inRange: {
          color: mempoolFeeColors.map(color => `#${color}`),
        },
      },
      series: {
        type: 'map',
        map: 'world',
        emphasis: {
          label: {
            show: false,
          },
          itemStyle: {
            areaColor: '#FDD835',
          }
        },
        data: countries,
        itemStyle: {
          areaColor: '#5A6A6D'
        },
      }
    };
  }

  onChartInit(ec) {
    if (this.chartInstance !== undefined) {
      return;
    }

    this.chartInstance = ec;

    this.chartInstance.on('click', (e) => {
      if (e.data && e.data.value > 0) {
        this.zone.run(() => {
          const url = new RelativeUrlPipe(this.stateService).transform(`/lightning/nodes/country/${e.data.iso}`);
          this.router.navigate([url]);
        });
      }
    });
  }

  onSaveChart() {
    // @ts-ignore
    const prevBottom = this.chartOptions.grid.bottom;
    const now = new Date();
    // @ts-ignore
    this.chartOptions.grid.bottom = 30;
    this.chartOptions.backgroundColor = '#11131f';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `lightning-nodes-heatmap-clearnet-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
