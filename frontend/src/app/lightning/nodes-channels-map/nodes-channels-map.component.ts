import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter, NgZone, OnInit } from '@angular/core';
import { SeoService } from 'src/app/services/seo.service';
import { ApiService } from 'src/app/services/api.service';
import { Observable, switchMap, tap, zip } from 'rxjs';
import { AssetsService } from 'src/app/services/assets.service';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { RelativeUrlPipe } from 'src/app/shared/pipes/relative-url/relative-url.pipe';
import { StateService } from 'src/app/services/state.service';
import { EChartsOption, registerMap } from 'echarts';
import 'echarts-gl';
import { isMobile } from 'src/app/shared/common.utils';

@Component({
  selector: 'app-nodes-channels-map',
  templateUrl: './nodes-channels-map.component.html',
  styleUrls: ['./nodes-channels-map.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesChannelsMap implements OnInit {
  @Input() style: 'graph' | 'nodepage' | 'widget' | 'channelpage' = 'graph';
  @Input() publicKey: string | undefined;
  @Input() channel: any[] = [];
  @Input() fitContainer = false;
  @Input() hasLocation = true;
  @Input() placeholder = false;
  @Input() disableSpinner = false;
  @Output() readyEvent = new EventEmitter();

  channelsObservable: Observable<any>; 

  center: number[] | undefined;
  zoom: number | undefined;
  channelWidth = 0.6;
  channelOpacity = 0.1;
  channelColor = '#466d9d';
  channelCurve = 0;
  nodeSize = 4;
  isLoading = false;

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

  ngOnInit(): void {
    this.center = this.style === 'widget' ? [0, 40] : [0, 5];
    this.zoom = 1.3;
    if (this.style === 'widget' && !isMobile()) {
      this.zoom = 3.5;
    }
    if (this.style === 'widget' && isMobile()) {
      this.zoom = 1.4;
      this.center = [0, 10];
    }
    
    if (this.style === 'graph') {
      this.seoService.setTitle($localize`Lightning nodes channels world map`);
    }

    if (['nodepage', 'channelpage'].includes(this.style)) {
      this.nodeSize = 8;
    }
    
    this.channelsObservable = this.activatedRoute.paramMap
     .pipe(
       switchMap((params: ParamMap) => {
        this.isLoading = true;
        if (this.style === 'channelpage' && this.channel.length === 0 || !this.hasLocation) {
          this.isLoading = false;
        }
            
        return zip(
          this.assetsService.getWorldMapJson$,
          this.style !== 'channelpage' ? this.apiService.getChannelsGeo$(params.get('public_key') ?? undefined, this.style) : [''],
          [params.get('public_key') ?? undefined]
        ).pipe(tap((data) => {
          registerMap('world', data[0]);

          const channelsLoc = [];
          const nodes = [];
          const nodesPubkeys = {};
          let thisNodeGPS: number[] | undefined = undefined;

          let geoloc = data[1];
          if (this.style === 'channelpage') {
            if (this.channel.length === 0) {
              geoloc = [];
            } else {
              geoloc = [this.channel];
            }
          }
          for (const channel of geoloc) {
            if (this.style === 'nodepage' && !thisNodeGPS) {
              if (data[2] === channel[0]) {
                thisNodeGPS = [channel[2], channel[3]];
              } else if (data[2] === channel[4]) {
                thisNodeGPS = [channel[6], channel[7]];
              }
            }

            // 0 - node1 pubkey
            // 1 - node1 alias
            // 2,3 - node1 GPS
            // 4 - node2 pubkey
            // 5 - node2 alias
            // 6,7 - node2 GPS
            const node1PubKey = 0;
            const node1Alias = 1;
            let node1GpsLat = 2;
            let node1GpsLgt = 3;
            const node2PubKey = 4;
            const node2Alias = 5;
            let node2GpsLat = 6;
            let node2GpsLgt = 7;
            let node1UniqueId = channel[node1PubKey];
            let node2UniqueId = channel[node2PubKey];
            if (this.style === 'widget') {
              node1GpsLat = 0;
              node1GpsLgt = 1;
              node2GpsLat = 2;
              node2GpsLgt = 3;
              node1UniqueId = channel[node1GpsLat].toString() + channel[node1GpsLgt].toString();
              node2UniqueId = channel[node2GpsLat].toString() + channel[node2GpsLgt].toString();
            }

            // We add a bit of noise so nodes at the same location are not all
            // on top of each other
            let random = Math.random() * 2 * Math.PI;
            let random2 = Math.random() * 0.01;
            
            if (!nodesPubkeys[node1UniqueId]) {
              nodes.push([
                channel[node1GpsLat] + random2 * Math.cos(random),
                channel[node1GpsLgt] + random2 * Math.sin(random),
                1,
                channel[node1PubKey],
                channel[node1Alias]
              ]);
              nodesPubkeys[node1UniqueId] = nodes[nodes.length - 1];
            }

            random = Math.random() * 2 * Math.PI;
            random2 = Math.random() * 0.01;

            if (!nodesPubkeys[node2UniqueId]) {
              nodes.push([
                channel[node2GpsLat] + random2 * Math.cos(random),
                channel[node2GpsLgt] + random2 * Math.sin(random),
                1,
                channel[node2PubKey],
                channel[node2Alias]
              ]);
              nodesPubkeys[node2UniqueId] = nodes[nodes.length - 1];
            }

            const channelLoc = [];
            channelLoc.push(nodesPubkeys[node1UniqueId].slice(0, 2));            
            channelLoc.push(nodesPubkeys[node2UniqueId].slice(0, 2));
            channelsLoc.push(channelLoc);
          }

          if (this.style === 'nodepage' && thisNodeGPS) {
            this.center = [thisNodeGPS[0], thisNodeGPS[1]];
            this.zoom = 5;
            this.channelWidth = 1;
            this.channelOpacity = 1;
          }

          if (this.style === 'channelpage' && this.channel.length > 0) {
            this.channelWidth = 2;
            this.channelOpacity = 1;
            this.channelColor = '#bafcff';
            this.channelCurve = 0.1;
            this.center = [
              (this.channel[2] + this.channel[6]) / 2,
              (this.channel[3] + this.channel[7]) / 2
            ];
            const distance = Math.sqrt(
              Math.pow(this.channel[7] - this.channel[3], 2) +
              Math.pow(this.channel[6] - this.channel[2], 2)
            );

            this.zoom = -0.05 * distance + 8;
          }

          this.prepareChartOptions(nodes, channelsLoc);
        }));
      })
     );
  }

  prepareChartOptions(nodes, channels) {
    let title: object;
    if (channels.length === 0 && !this.placeholder) {
      this.chartOptions = null;
      return;
    }

    // empty map fallback
    if (channels.length === 0 && this.placeholder) {
      title = {
        textStyle: {
          color: 'white',
          fontSize: 18
        },
        text: $localize`No geolocation data available`,
        left: 'center',
        top: 'center'
      };
      this.zoom = 1.5;
      this.center = [0, 20];
    }

    this.chartOptions = {
      silent: this.style === 'widget',
      title: title ?? undefined,
      tooltip: {},
      geo: {
        animation: false,
        silent: true,
        center: this.center,
        zoom: this.zoom,
        tooltip: {
          show: false
        },
        map: 'world',
        roam: this.style === 'widget' ? false : true,
        itemStyle: {
          borderColor: 'black',
          color: '#272b3f'
        },
        scaleLimit: {
          min: 1.3,
          max: 100000,
        },
        emphasis: {
          disabled: true,
        }
      },
      series: [
        {
          large: true,
          type: 'scatter',
          data: nodes,
          coordinateSystem: 'geo',
          geoIndex: 0,
          symbolSize: this.nodeSize,
          tooltip: {
            show: true,
            backgroundColor: 'rgba(17, 19, 31, 1)',
            borderRadius: 4,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
            textStyle: {
              color: '#b1b1b1',
              align: 'left',
            },
            borderColor: '#000',
            formatter: (value) => {
              const data = value.data;
              const alias = data[4].length > 0 ? data[4] : data[3].slice(0, 20);
              return `<b style="color: white">${alias}</b>`;
            }
          },
          itemStyle: {
            color: 'white',
            opacity: 1,
            borderColor: 'black',
            borderWidth: 0,
          },
          blendMode: 'lighter',
          zlevel: 2,
        },
        {
          large: false,
          progressive: this.style === 'widget' ? 500 : 200,
          silent: true,
          type: 'lines',
          coordinateSystem: 'geo',
          data: channels,
          lineStyle: {
            opacity: this.channelOpacity,
            width: this.channelWidth,
            curveness: this.channelCurve,
            color: this.channelColor,
          },
          blendMode: 'lighter',
          tooltip: {
            show: false,
          },
          zlevel: 1,
        }
      ]
    };
  }

  onChartInit(ec) {
    if (this.chartInstance !== undefined) {
      return;
    }

    this.chartInstance = ec;

    this.chartInstance.on('finished', () => {
      this.isLoading = false;
    });
    
    if (this.style === 'widget') {
      this.chartInstance.getZr().on('click', (e) => {
        this.zone.run(() => {
          const url = new RelativeUrlPipe(this.stateService).transform(`/graphs/lightning/nodes-channels-map`);
          this.router.navigate([url]);
        });
      });
    }
      
    this.chartInstance.on('click', (e) => {
      if (e.data) {
        this.zone.run(() => {
          const url = new RelativeUrlPipe(this.stateService).transform(`/lightning/node/${e.data[3]}`);
          this.router.navigate([url]);
        });
      }
    });

    this.chartInstance.on('georoam', (e) => {
      if (!e.zoom || this.style === 'nodepage') {
        return;
      }

      const speed = 0.005;
      const chartOptions = {
        series: this.chartOptions.series
      };

      let nodeBorder = 0;
      if (this.chartInstance.getOption().geo[0].zoom > 5000) {
        nodeBorder = 2;
      }

      chartOptions.series[0].itemStyle.borderWidth = nodeBorder;
      chartOptions.series[0].symbolSize += e.zoom > 1 ? speed * 15 : -speed * 15;
      chartOptions.series[0].symbolSize = Math.max(4, Math.min(7, chartOptions.series[0].symbolSize));

      chartOptions.series[1].lineStyle.opacity += e.zoom > 1 ? speed : -speed;
      chartOptions.series[1].lineStyle.width += e.zoom > 1 ? speed : -speed;
      chartOptions.series[1].lineStyle.opacity = Math.max(0.05, Math.min(0.5, chartOptions.series[1].lineStyle.opacity));
      chartOptions.series[1].lineStyle.width = Math.max(0.5, Math.min(1, chartOptions.series[1].lineStyle.width));

      this.chartInstance.setOption(chartOptions);
    });
  }

  onChartFinished(e) {
    this.readyEvent.emit();
  }
}
