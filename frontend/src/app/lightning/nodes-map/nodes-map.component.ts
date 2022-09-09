import { ChangeDetectionStrategy, Component, Inject, LOCALE_ID, NgZone, OnDestroy, OnInit } from '@angular/core';
import { SeoService } from 'src/app/services/seo.service';
import { ApiService } from 'src/app/services/api.service';
import { Observable, tap, zip } from 'rxjs';
import { AssetsService } from 'src/app/services/assets.service';
import { EChartsOption, registerMap } from 'echarts';
import { lerpColor } from 'src/app/shared/graphs.utils';
import { Router } from '@angular/router';
import { RelativeUrlPipe } from 'src/app/shared/pipes/relative-url/relative-url.pipe';
import { StateService } from 'src/app/services/state.service';
import { AmountShortenerPipe } from 'src/app/shared/pipes/amount-shortener.pipe';
import { getFlagEmoji } from 'src/app/shared/common.utils';

@Component({
  selector: 'app-nodes-map',
  templateUrl: './nodes-map.component.html',
  styleUrls: ['./nodes-map.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesMap implements OnInit {
  observable$: Observable<any>;

  chartInstance = undefined;
  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private stateService: StateService,
    private assetsService: AssetsService,
    private router: Router,
    private zone: NgZone,
    private amountShortenerPipe: AmountShortenerPipe
  ) {
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`Lightning nodes world map`);

    this.observable$ = zip(
      this.assetsService.getWorldMapJson$,
      this.apiService.getWorldNodes$()
    ).pipe(tap((data) => {
      registerMap('world', data[0]);

      const nodes: any[] = [];
      console.log(data[1].nodes[0]);
      for (const node of data[1].nodes) {
        // We add a bit of noise so nodes at the same location are not all
        // on top of each other
        const random = Math.random() * 2 * Math.PI;
        const random2 = Math.random() * 0.01;
        nodes.push([
          node[0] + random2 * Math.cos(random),
          node[1] + random2 * Math.sin(random),
          node[4], // Liquidity
          node[3], // Alias
          node[2], // Public key
          node[5], // Channels
          node[6].en, // Country
          node[7], // ISO Code
        ]);
      }

      this.prepareChartOptions(nodes, data[1].maxLiquidity);
    }));
  }

  prepareChartOptions(nodes, maxLiquidity) {
    let title: object;
    if (nodes.length === 0) {
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
      silent: false,
      title: title ?? undefined,
      tooltip: {},
      geo: {
        animation: false,
        silent: true,
        center: [0, 5],
        zoom: 1.3,
        tooltip: {
          show: false
        },
        map: 'world',
        roam: true,
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
          large: false,
          type: 'scatter',
          data: nodes,
          coordinateSystem: 'geo',
          geoIndex: 0,
          progressive: 500,
          symbolSize: function (params) {
            return 10 * Math.pow(params[2] / maxLiquidity, 0.2) + 3;
          },
          tooltip: {
            trigger: 'item',
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
              const alias = data[3].length > 0 ? data[3] : data[4].slice(0, 20);
              const liquidity = data[2] >= 100000000 ?
                `${this.amountShortenerPipe.transform(data[2] / 100000000)} BTC` :
                `${this.amountShortenerPipe.transform(data[2], 2)} sats`;

              return `
                <b style="color: white">${alias}</b><br>
                ${liquidity}<br>
                ${data[5]} channels<br>
                ${getFlagEmoji(data[7])} ${data[6]}
              `;
            }
          },
          itemStyle: {
            color: function (params) {
              return `${lerpColor('#1E88E5', '#D81B60', Math.pow(params.data[2] / maxLiquidity, 0.2))}`;
            },
            opacity: 1,
            borderColor: 'black',
            borderWidth: 0,
          },
          blendMode: 'lighter',
          zlevel: 2,
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
      if (e.data) {
        this.zone.run(() => {
          const url = new RelativeUrlPipe(this.stateService).transform(`/lightning/node/${e.data[4]}`);
          this.router.navigate([url]);
        });
      }
    });

    this.chartInstance.on('georoam', (e) => {
      this.chartInstance.resize();
    });
  }
}
