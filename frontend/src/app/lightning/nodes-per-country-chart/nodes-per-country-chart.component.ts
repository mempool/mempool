import { ChangeDetectionStrategy, Component, OnInit, HostBinding, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { EChartsOption, PieSeriesOption } from '@app/graphs/echarts';
import { map, Observable, share, tap } from 'rxjs';
import { chartColors } from '@app/app.constants';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { StateService } from '@app/services/state.service';
import { download } from '@app/shared/graphs.utils';
import { AmountShortenerPipe } from '@app/shared/pipes/amount-shortener.pipe';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { getFlagEmoji } from '@app/shared/common.utils';

@Component({
  selector: 'app-nodes-per-country-chart',
  templateUrl: './nodes-per-country-chart.component.html',
  styleUrls: ['./nodes-per-country-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesPerCountryChartComponent implements OnInit {
  miningWindowPreference: string;

  isLoading = true;
  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };
  timespan = '';
  chartInstance: any = undefined;

  @HostBinding('attr.dir') dir = 'ltr';

  nodesPerCountryObservable$: Observable<any>;

  constructor(
    private apiService: ApiService,
    private seoService: SeoService,
    private amountShortenerPipe: AmountShortenerPipe,
    private zone: NgZone,
    public stateService: StateService,
    private router: Router,
  ) {
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@9d3ad4c6623870d96b65fb7a708fed6ce7c20044:Lightning Nodes Per Country`);
    this.seoService.setDescription($localize`:@@meta.description.lightning.nodes-country-overview:See a geographical breakdown of the Lightning network: how many Lightning nodes are hosted in countries around the world, aggregate BTC capacity for each country, and more.`);
    this.nodesPerCountryObservable$ = this.apiService.getNodesPerCountry$()
      .pipe(
        map(data => {
          for (let i = 0; i < data.length; ++i) {
            data[i].rank = i + 1;
            data[i].iso = data[i].iso.toLowerCase();
            data[i].flag = getFlagEmoji(data[i].iso);
          }
          return data.slice(0, 100);
        }),
        tap(data => {
          this.isLoading = false;
          this.prepareChartOptions(data);
        }),
        share()
      );
  }

  generateChartSerieData(country) {
    const shareThreshold = this.isMobile() ? 2 : 1;
    const data: object[] = [];
    let totalShareOther = 0;
    let totalNodeOther = 0;

    let edgeDistance: string | number = '10%';
    if (this.isMobile()) {
      edgeDistance = 0;
    }

    country.forEach((country) => {
      if (country.share < shareThreshold) {
        totalShareOther += country.share;
        totalNodeOther += country.count;
        return;
      }
      data.push({
        value: country.share,
        name: country.name.en + (this.isMobile() ? `` : ` (${country.share}%)`),
        label: {
          overflow: 'truncate',
          color: 'var(--tooltip-grey)',
          alignTo: 'edge',
          edgeDistance: edgeDistance,
        },
        tooltip: {
          show: !this.isMobile(),
          backgroundColor: 'rgba(17, 19, 31, 1)',
          borderRadius: 4,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
          textStyle: {
            color: 'var(--tooltip-grey)',
          },
          borderColor: '#000',
          formatter: () => {
            const nodeCount = country.count.toString();
            return `<b style="color: white">${country.name.en} (${country.share}%)</b><br>` +
              $localize`${nodeCount} nodes` + `<br>` +
              $localize`${this.amountShortenerPipe.transform(country.capacity / 100000000, 2)} BTC capacity`
            ;
          }
        },
        data: country.iso,
      } as PieSeriesOption);
    });

    // 'Other'
    data.push({
      itemStyle: {
        color: 'grey',
      },
      value: totalShareOther,
      name: $localize`Other (${totalShareOther.toFixed(2) + '%'})`,
      label: {
        overflow: 'truncate',
        color: 'var(--tooltip-grey)',
        alignTo: 'edge',
        edgeDistance: edgeDistance
      },
      tooltip: {
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: 'var(--tooltip-grey)',
        },
        borderColor: '#000',
        formatter: () => {
          const nodeCount = totalNodeOther.toString();
          return `<b style="color: white">` + $localize`Other (${totalShareOther.toFixed(2) + '%'})` + `</b><br>` +
            $localize`${nodeCount} nodes`;
        },
      },
      data: 9999 as any
    } as PieSeriesOption);

    return data;
  }

  prepareChartOptions(country) {
    let pieSize = ['20%', '80%']; // Desktop
    if (this.isMobile()) {
      pieSize = ['15%', '60%'];
    }

    this.chartOptions = {
      animation: false,
      color: chartColors,
      tooltip: {
        trigger: 'item',
        textStyle: {
          align: 'left',
        }
      },
      series: [
        {
          zlevel: 0,
          minShowLabelAngle: 3.6,
          name: 'Mining pool',
          type: 'pie',
          radius: pieSize,
          data: this.generateChartSerieData(country),
          labelLine: {
            lineStyle: {
              width: 2,
            },
            length: this.isMobile() ? 1 : 20,
            length2: this.isMobile() ? 1 : undefined,
          },
          label: {
            fontSize: 14,
          },
          itemStyle: {
            borderRadius: 1,
            borderWidth: 1,
            borderColor: '#000',
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 40,
              shadowColor: 'rgba(0, 0, 0, 0.75)',
            },
            labelLine: {
              lineStyle: {
                width: 4,
              }
            }
          }
        }
      ],
    };
  }

  isMobile() {
    return (window.innerWidth <= 767.98);
  }

  onChartInit(ec) {
    if (this.chartInstance !== undefined) {
      return;
    }
    this.chartInstance = ec;

    this.chartInstance.on('click', (e) => {
      if (e.data.data === 9999) { // "Other"
        return;
      }
      this.zone.run(() => {
        const url = new RelativeUrlPipe(this.stateService).transform(`/lightning/nodes/country/${e.data.data}`);
        this.router.navigate([url]);
      });
    });
  }

  onSaveChart() {
    const now = new Date();
    this.chartOptions.backgroundColor = 'var(--active-bg)';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `lightning-nodes-per-country-${Math.round(now.getTime() / 1000)}.svg`);
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }

  isEllipsisActive(e) {
    return (e.offsetWidth < e.scrollWidth);
  }
}

