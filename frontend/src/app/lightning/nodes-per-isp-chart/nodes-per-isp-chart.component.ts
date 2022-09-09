import { ChangeDetectionStrategy, Component, OnInit, HostBinding, NgZone, Input } from '@angular/core';
import { Router } from '@angular/router';
import { EChartsOption, PieSeriesOption } from 'echarts';
import { combineLatest, map, Observable, share, startWith, Subject, switchMap, tap } from 'rxjs';
import { chartColors } from 'src/app/app.constants';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { StateService } from 'src/app/services/state.service';
import { isMobile } from 'src/app/shared/common.utils';
import { download } from 'src/app/shared/graphs.utils';
import { AmountShortenerPipe } from 'src/app/shared/pipes/amount-shortener.pipe';
import { RelativeUrlPipe } from 'src/app/shared/pipes/relative-url/relative-url.pipe';

@Component({
  selector: 'app-nodes-per-isp-chart',
  templateUrl: './nodes-per-isp-chart.component.html',
  styleUrls: ['./nodes-per-isp-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesPerISPChartComponent implements OnInit {
  @Input() widget: boolean = false;

  isLoading = true;
  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };
  timespan = '';
  sortBy = 'capacity';
  showUnknown = false;
  chartInstance = undefined;

  @HostBinding('attr.dir') dir = 'ltr';

  nodesPerAsObservable$: Observable<any>;
  sortBySubject = new Subject<boolean>();
  showUnknownSubject = new Subject<boolean>();

  constructor(
    private apiService: ApiService,
    private seoService: SeoService,
    private amountShortenerPipe: AmountShortenerPipe,
    private router: Router,
    private zone: NgZone,
    private stateService: StateService,
  ) {
  }

  ngOnInit(): void {
    if (!this.widget) {
      this.seoService.setTitle($localize`Lightning nodes per ISP`);
    }

    this.nodesPerAsObservable$ = combineLatest([
      this.sortBySubject.pipe(startWith(true)),
    ])
      .pipe(
        switchMap((selectedFilters) => {
          this.sortBy = selectedFilters[0] ? 'capacity' : 'node-count';
          return this.apiService.getNodesPerIsp()
            .pipe(
              tap(() => {
                this.isLoading = false;
              }),
              map(data => {
                let nodeCount = 0;
                let totalCapacity = 0;

                for (let i = 0; i < data.ispRanking.length; ++i) {
                  nodeCount += data.ispRanking[i][4];
                  totalCapacity += data.ispRanking[i][2];
                  data.ispRanking[i][5] = i;
                }
                for (let i = 0; i < data.ispRanking.length; ++i) {
                  data.ispRanking[i][6] = Math.round(data.ispRanking[i][4] / nodeCount * 10000) / 100;
                  data.ispRanking[i][7] = Math.round(data.ispRanking[i][2] / totalCapacity * 10000) / 100;
                }

                if (selectedFilters[0] === true) {
                  data.ispRanking.sort((a, b) => b[7] - a[7]);
                } else {
                  data.ispRanking.sort((a, b) => b[6] - a[6]);
                }

                for (let i = 0; i < data.ispRanking.length; ++i) {
                  data.ispRanking[i][5] = i + 1;
                }

                this.prepareChartOptions(data.ispRanking);

                return {
                  taggedISP: data.ispRanking.length,
                  clearnetCapacity: data.clearnetCapacity,
                  unknownCapacity: data.unknownCapacity,
                  torCapacity: data.torCapacity,
                  ispRanking: data.ispRanking.slice(0, 100),
                };
              })
            );
        }),
        share()
      );

    if (this.widget) {
      this.sortBySubject.next(false);  
    }
  }

  generateChartSerieData(ispRanking): PieSeriesOption[] {
    let shareThreshold = 0.4;
    if (this.widget && isMobile() || isMobile()) {
      shareThreshold = 1;
    } else if (this.widget) {
      shareThreshold = 0.75;
    }

    const data: object[] = [];
    let totalShareOther = 0;
    let nodeCountOther = 0;
    let capacityOther = 0;

    let edgeDistance: string | number = '10%';
    if (isMobile() && this.widget) {
      edgeDistance = 0;
    } else if (isMobile() && !this.widget || this.widget) {
      edgeDistance = 10;
    }

    ispRanking.forEach((isp) => {
      if ((this.sortBy === 'capacity' ? isp[7] : isp[6]) < shareThreshold) {
        totalShareOther += this.sortBy === 'capacity' ? isp[7] : isp[6];
        nodeCountOther += isp[4];
        capacityOther += isp[2];
        return;
      }
      data.push({
        value: this.sortBy === 'capacity' ? isp[7] : isp[6],
        name: isp[1].replace('&', '') + (isMobile() || this.widget ? `` : ` (${this.sortBy === 'capacity' ? isp[7] : isp[6]}%)`),
        label: {
          overflow: 'truncate',
          width: isMobile() ? 75 : this.widget ? 125 : 250,
          color: '#b1b1b1',
          alignTo: 'edge',
          edgeDistance: edgeDistance,
        },
        tooltip: {
          show: !isMobile(),
          backgroundColor: 'rgba(17, 19, 31, 1)',
          borderRadius: 4,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
          textStyle: {
            color: '#b1b1b1',
          },
          borderColor: '#000',
          formatter: () => {
            return `<b style="color: white">${isp[1]} (${this.sortBy === 'capacity' ? isp[7] : isp[6]}%)</b><br>` +
              $localize`${isp[4].toString()} nodes<br>` +
              $localize`${this.amountShortenerPipe.transform(isp[2] / 100000000, 2)} BTC`
            ;
          }
        },
        data: isp[0],
      } as PieSeriesOption);
    });

    // 'Other'
    data.push({
      itemStyle: {
        color: 'grey',
      },
      value: totalShareOther,
      name: 'Other' + (isMobile() || this.widget ? `` : ` (${totalShareOther.toFixed(2)}%)`),
      label: {
        overflow: 'truncate',
        color: '#b1b1b1',
        alignTo: 'edge',
        edgeDistance: edgeDistance
      },
      tooltip: {
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: '#b1b1b1',
        },
        borderColor: '#000',
        formatter: () => {
          return `<b style="color: white">Other (${totalShareOther.toFixed(2)}%)</b><br>` +
            $localize`${nodeCountOther.toString()} nodes<br>` +
            $localize`${this.amountShortenerPipe.transform(capacityOther / 100000000, 2)} BTC`;
        }
      },
      data: 9999 as any,
    } as PieSeriesOption);

    return data;
  }

  prepareChartOptions(ispRanking): void {
    let pieSize = ['20%', '80%']; // Desktop
    if (isMobile() && !this.widget) {
      pieSize = ['15%', '60%'];
    }

    this.chartOptions = {
      color: chartColors.filter((color) => color != '#5E35B1'), // Remove color that looks like Tor
      tooltip: {
        trigger: 'item',
        textStyle: {
          align: 'left',
        }
      },
      series: [
        {
          zlevel: 0,
          minShowLabelAngle: 0.9,
          name: 'Lightning nodes',
          type: 'pie',
          radius: pieSize,
          data: this.generateChartSerieData(ispRanking),
          labelLine: {
            lineStyle: {
              width: 2,
            },
            length: isMobile() ? 1 : 20,
            length2: isMobile() ? 1 : undefined,
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

  onChartInit(ec): void {
    if (this.chartInstance !== undefined) {
      return;
    }
    this.chartInstance = ec;

    this.chartInstance.on('click', (e) => {
      if (e.data.data === 9999 || e.data.data === null) { // "Other" or Tor
        return;
      }
      this.zone.run(() => {
        const url = new RelativeUrlPipe(this.stateService).transform(`/lightning/nodes/isp/${e.data.data}`);
        this.router.navigate([url]);
      });
    });
  }

  onSaveChart(): void {
    const now = new Date();
    this.chartOptions.backgroundColor = '#11131f';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `ln-nodes-per-as-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }

  onGroupToggleStatusChanged(e): void {
    this.sortBySubject.next(e);
  }
}

