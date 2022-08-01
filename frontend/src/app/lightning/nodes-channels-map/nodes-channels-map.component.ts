import { ChangeDetectionStrategy, Component, HostListener, Input, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { SeoService } from 'src/app/services/seo.service';
import { ApiService } from 'src/app/services/api.service';
import { Observable, switchMap, tap, zip } from 'rxjs';
import { AssetsService } from 'src/app/services/assets.service';
import { download } from 'src/app/shared/graphs.utils';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
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
  @Input() style: 'graph' | 'nodepage' | 'widget' = 'graph';
  @Input() publicKey: string | undefined;

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
    private activatedRoute: ActivatedRoute,
  ) {
  }

  ngOnDestroy(): void {}

  ngOnInit(): void {
    if (this.style === 'graph') {
      this.seoService.setTitle($localize`Lightning nodes channels world map`);
    }
    
    this.observable$ = this.activatedRoute.paramMap
     .pipe(
       switchMap((params: ParamMap) => {
        return zip(
          this.assetsService.getWorldMapJson$,
          this.apiService.getChannelsGeo$(params.get('public_key') ?? undefined),
        ).pipe(tap((data) => {
          registerMap('world', data[0]);

          const channelsLoc = [];
          const nodes = [];
          const nodesPubkeys = {};
          for (const channel of data[1]) {
            channelsLoc.push([[channel[2], channel[3]], [channel[6], channel[7]]]);
            if (!nodesPubkeys[channel[0]]) {
              nodes.push({
                publicKey: channel[0],
                name: channel[1],
                value: [channel[2], channel[3]],
              });
              nodesPubkeys[channel[0]] = true;
            }
            if (!nodesPubkeys[channel[4]]) {
              nodes.push({
                publicKey: channel[4],
                name: channel[5],
                value: [channel[6], channel[7]],
              });
              nodesPubkeys[channel[4]] = true;  
            }
          }
          this.prepareChartOptions(nodes, channelsLoc);
        }));
      })
     );
  }

  prepareChartOptions(nodes, channels) {
    let title: object;
    if (channels.length === 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: $localize`No geolocation data available`,
        left: 'center',
        top: 'center'
      };
    }

    this.chartOptions = {
      silent: this.style === 'widget' ? true : false,
      title: title ?? undefined,
      geo3D: {
        map: 'world',
        shading: 'color',
        silent: true,
        postEffect: {
          enable: true,
          bloom: {
            intensity: 0.1,
          }
        },
        viewControl: {
          center: this.style === 'widget' ? [0, 0, -10] : undefined,
          minDistance: this.style === 'widget' ? 22 : 0.1,
          maxDistance: this.style === 'widget' ? 22 : 60,
          distance: this.style === 'widget' ? 22 : 60,
          alpha: 90,
          panMouseButton: 'left',
          rotateMouseButton: undefined,
          zoomSensivity: 0.5,
        },
        itemStyle: {
          color: 'white',
          opacity: 0.02,
          borderWidth: 1,
          borderColor: 'black',
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
            opacity: ['widget', 'graph'].includes(this.style) ? 0.025 : 1,
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

  @HostListener('window:wheel', ['$event'])
  onWindowScroll(e): void {
    // Not very smooth when using the mouse
    if (this.style === 'widget' && e.target.tagName === 'CANVAS') {
      window.scrollBy({left: 0, top: e.deltaY, behavior: 'auto'});
    }
  }

  onChartInit(ec) {
    if (this.chartInstance !== undefined) {
      return;
    }

    this.chartInstance = ec;

    if (this.style === 'widget') {
      this.chartInstance.getZr().on('click', (e) => {
        this.zone.run(() => {
          const url = new RelativeUrlPipe(this.stateService).transform(`/graphs/lightning/nodes-channels-map`);
          this.router.navigate([url]);
        });
      });
    }
    
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
