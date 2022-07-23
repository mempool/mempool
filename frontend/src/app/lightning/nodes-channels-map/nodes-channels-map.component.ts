import { ChangeDetectionStrategy, Component, Input, NgZone, OnDestroy, OnInit } from '@angular/core';
import { SeoService } from 'src/app/services/seo.service';
import { ApiService } from 'src/app/services/api.service';
import { Observable, tap, zip } from 'rxjs';
import { AssetsService } from 'src/app/services/assets.service';
import { download } from 'src/app/shared/graphs.utils';
import { Router } from '@angular/router';
import { RelativeUrlPipe } from 'src/app/shared/pipes/relative-url/relative-url.pipe';
import { StateService } from 'src/app/services/state.service';
import { EChartsOption, registerMap } from 'echarts';
import 'echarts-gl';

@Component({
  selector: 'app-nodes-channels-map',
  templateUrl: './nodes-channels-map.component.html',
  styleUrls: ['./nodes-channels-map.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesChannelsMap implements OnInit, OnDestroy {
  @Input() widget = false;
  observable$: Observable<any>;

  chartInstance = undefined;
  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'canvas',
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
    this.seoService.setTitle($localize`Lightning nodes channels world map`);

    this.observable$ = zip(
      this.assetsService.getWorldMapJson$,
      this.apiService.getChannelsGeo$(),
    ).pipe(tap((data) => {
      registerMap('world', data[0]);

      const channelsLoc = [];
      const nodes = [];
      for (const channel of data[1]) {
        channelsLoc.push([[channel[2], channel[3]], [channel[6], channel[7]]]);
        nodes.push({
          publicKey: channel[0],
          name: channel[1],
          value: [channel[2], channel[3]],
        });
        nodes.push({
          publicKey: channel[4],
          name: channel[5],
          value: [channel[6], channel[7]],
        });
      }

      this.prepareChartOptions(nodes, channelsLoc);
    }));
  }

  prepareChartOptions(nodes, channels) {
    let title: object;
    if (channels.length === 0) {
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
      geo3D: {
        map: 'world',
        shading: 'color',
        silent: true,
        postEffect: {
          enable: true,
          bloom: {
            intensity: 0.01,
          }
        },
        viewControl: {
          center: this.widget ? [2, 0, -10] : undefined,
          minDistance: 0.1,
          distance: this.widget ? 20 : 60,
          alpha: 90,
          panMouseButton: 'left',
          rotateMouseButton: 'none',
          zoomSensivity: 0.5,
        },
        itemStyle: {
          color: '#FFFFFF',
          opacity: 0.02,
          borderWidth: 1,
          borderColor: '#00000050',
        },
        regionHeight: 0.01,
      },
      series: [
        {
          // @ts-ignore
          type: 'lines3D',
          coordinateSystem: 'geo3D',
          blendMode: 'lighter',
          lineStyle: {
            width: 1,
            opacity: 0.025,
          },
          data: channels
        },
        {
          // @ts-ignore
          type: 'scatter3D',
          symbol: 'circle',
          blendMode: 'lighter',
          coordinateSystem: 'geo3D',
          symbolSize: 3,
          itemStyle: {
            color: '#BBFFFF',
            opacity: 1,
            borderColor: '#FFFFFF00',
          },
          data: nodes,
          emphasis: {
            label: {
              position: 'top',
              color: 'white',
              fontSize: 16,
              formatter: function(value) {
                return value.name;
              },
              show: true,
            }
          }
        },
      ]
    };
  }

  onChartInit(ec) {
    if (this.chartInstance !== undefined) {
      return;
    }

    this.chartInstance = ec;

    this.chartInstance.on('click', (e) => {
      if (e.data && e.data.publicKey) {
        this.zone.run(() => {
          const url = new RelativeUrlPipe(this.stateService).transform(`/lightning/node/${e.data.publicKey}`);
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
