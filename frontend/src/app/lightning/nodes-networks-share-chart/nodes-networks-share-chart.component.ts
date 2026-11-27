import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostBinding,
  Inject,
  LOCALE_ID,
  NgZone,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable, Subscription, combineLatest } from 'rxjs';
import { map, share, startWith, tap } from 'rxjs/operators';
import { EChartsOption } from '@app/graphs/echarts';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { StateService } from '@app/services/state.service';
import { StorageService } from '@app/services/storage.service';
import { download } from '@app/shared/graphs.utils';
import { isMobile } from '@app/shared/common.utils';
import {
  VennLabel,
  computeVennLayout,
} from '@app/lightning/nodes-networks-share-chart/venn.utils';

type Metric = 'nodes' | 'channels' | 'capacity';
type Region = 'clearnet' | 'clearnetDarknet' | 'darknet' | 'unknown';

interface NetworkShare {
  nodes: number;
  channels: number;
  capacity: number;
}

const METRICS: Metric[] = ['nodes', 'channels', 'capacity'];
const LEGEND_STORAGE_KEY = 'nodes_networks_share_legend';

@Component({
  selector: 'app-nodes-networks-share-chart',
  templateUrl: './nodes-networks-share-chart.component.html',
  styleUrls: ['./nodes-networks-share-chart.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesNetworksShareChartComponent implements OnInit, OnDestroy {
  @HostBinding('attr.dir') dir = 'ltr';

  readonly regions: Region[] = [
    'clearnet',
    'clearnetDarknet',
    'darknet',
    'unknown',
  ];
  readonly metrics = METRICS;
  readonly colors: Record<Region, string> = {
    clearnet: '#FFB300',
    clearnetDarknet: '#be7d4c',
    darknet: '#7D4698',
    unknown: '#D81B60',
  };
  readonly names: Record<Region, string> = {
    clearnet: $localize`Clearnet Only (IPv4, IPv6)`,
    clearnetDarknet: $localize`Clearnet and Darknet`,
    darknet: $localize`Darknet Only (Tor, I2P, cjdns)`,
    unknown: $localize`:@@e5d8bb389c702588877f039d72178f219453a72d:Unknown`,
  };
  readonly vennLabels: Record<Region, string> = {
    clearnet: $localize`:@@lightning.clearnet-only:Clearnet only`,
    clearnetDarknet: $localize`:@@lightning.clearnet-and-darknet-both:Both`,
    darknet: $localize`:@@lightning.darknet-only:Darknet only`,
    unknown: $localize`:@@e5d8bb389c702588877f039d72178f219453a72d:Unknown`,
  };
  readonly metricNames: Record<Metric, string> = {
    nodes: $localize`:@@lightning.nodes-count:Nodes`,
    channels: $localize`:@@lightning.channels:Channels`,
    capacity: $localize`:@@lightning.capacity:Capacity`,
  };

  radioGroupForm: UntypedFormGroup;
  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };
  chartInstance: any = undefined;
  isLoading = true;

  shares$: Observable<Record<Region, NetworkShare>>;
  fragmentSubscription: Subscription;

  metric: Metric = 'nodes';
  shares: Record<Region, NetworkShare>;
  percents: Record<Region, NetworkShare>;
  legendSelected: Record<string, boolean>;
  hoveredRegion: Region | null = null;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private apiService: ApiService,
    private seoService: SeoService,
    private storageService: StorageService,
    private formBuilder: UntypedFormBuilder,
    private route: ActivatedRoute,
    private cd: ChangeDetectorRef,
    private zone: NgZone,
    public stateService: StateService
  ) {}

  ngOnInit(): void {
    this.seoService.setTitle(
      $localize`:@@lightning.network-shares:Lightning Network Shares`
    );
    this.seoService.setDescription(
      $localize`:@@meta.description.lightning.network-shares:See how Lightning network nodes, channels and capacity are split between clearnet (IPv4, IPv6), darknet (Tor, I2P, cjdns) and nodes reachable on both.`
    );

    // Unknown is not part of the diagram, so it starts unselected
    // getValue() returns '' when storage is unavailable (and in SSR)
    const storedLegend = this.storageService.getValue(LEGEND_STORAGE_KEY);
    this.legendSelected = (storedLegend && JSON.parse(storedLegend)) || {
      [this.names.clearnet]: true,
      [this.names.clearnetDarknet]: true,
      [this.names.darknet]: true,
      [this.names.unknown]: false,
    };

    this.radioGroupForm = this.formBuilder.group({ metric: this.metric });

    this.fragmentSubscription = this.route.fragment.subscribe((fragment) => {
      if (METRICS.includes(fragment as Metric)) {
        this.radioGroupForm.controls.metric.setValue(fragment);
      }
    });

    this.shares$ = combineLatest([
      this.apiService.getNodesNetworksShare$().pipe(
        tap((shares) => {
          this.shares = shares;
          this.percents = this.computePercents(shares);
          this.isLoading = false;
        })
      ),
      this.radioGroupForm
        .get('metric')
        .valueChanges.pipe(startWith(this.radioGroupForm.get('metric').value)),
    ]).pipe(
      tap(([, metric]) => {
        this.metric = metric;
        this.prepareChartOptions();
      }),
      map(() => this.shares),
      share()
    );
  }

  computePercents(
    shares: Record<Region, NetworkShare>
  ): Record<Region, NetworkShare> {
    const percents = {} as Record<Region, NetworkShare>;
    for (const region of this.regions) {
      percents[region] = { nodes: 0, channels: 0, capacity: 0 };
    }
    for (const metric of METRICS) {
      const total = this.regions.reduce(
        (sum, region) => sum + (shares[region]?.[metric] ?? 0),
        0
      );
      for (const region of this.regions) {
        percents[region][metric] =
          total > 0 ? ((shares[region]?.[metric] ?? 0) / total) * 100 : 0;
      }
    }
    return percents;
  }

  isRegionSelected(region: Region): boolean {
    return this.legendSelected[this.names[region]] !== false;
  }

  formatValue(value: number, metric: Metric): string {
    if (metric === 'capacity') {
      return `${formatNumber(value / 100_000_000, this.locale, '1.2-2')} BTC`;
    }
    return formatNumber(value, this.locale, '1.0-0');
  }

  formatPercent(value: number): string {
    return `${formatNumber(value, this.locale, '1.1-1')}%`;
  }

  prepareChartOptions(): void {
    const metric = this.metric;
    const valueOf = (region: Region): number =>
      this.shares[region]?.[metric] ?? 0;
    const mobile = isMobile();
    const legendSpace = mobile ? 70 : 50;

    const regionSeries = (region: Region) => ({
      name: this.names[region],
      type: 'custom',
      coordinateSystem: 'none',
      color: this.colors[region],
      data: [valueOf(region)],
      emphasis: {
        focus: 'series',
      },
      renderItem: (params, api) => {
        // Unknown nodes announce no address: they are in the legend and the table, not in the diagram
        if (region === 'unknown') {
          return null;
        }
        const layout = computeVennLayout(
          {
            x: 0,
            y: legendSpace,
            width: api.getWidth(),
            height: Math.max(api.getHeight() - legendSpace - 10, 0),
          },
          valueOf('clearnet') + valueOf('clearnetDarknet'),
          valueOf('darknet') + valueOf('clearnetDarknet'),
          valueOf('clearnetDarknet'),
          { sideSpace: mobile ? 84 : 100, minLabelWidth: mobile ? 72 : 96 }
        );
        const path = {
          clearnet: layout.onlyAPath,
          clearnetDarknet: layout.bothPath,
          darknet: layout.onlyBPath,
        }[region];
        const label: VennLabel = {
          clearnet: layout.labels.onlyA,
          clearnetDarknet: layout.labels.both,
          darknet: layout.labels.onlyB,
        }[region];
        if (!path) {
          return null;
        }
        return {
          type: 'group',
          children: [
            {
              type: 'path',
              shape: { pathData: path },
              style: {
                fill: this.colors[region],
                opacity: 0.55,
                stroke: this.colors[region],
                lineWidth: 2,
              },
              emphasis: { style: { opacity: 0.85 } },
            },
            {
              type: 'text',
              x: label.x,
              y: label.y,
              silent: true,
              style: {
                text: `{pct|${this.formatPercent(
                  this.percents[region][metric]
                )}}\n{name|${this.vennLabels[region]}}`,
                align: label.align ?? 'center',
                verticalAlign: label.verticalAlign ?? 'middle',
                fill: 'var(--fg)',
                rich: {
                  pct: {
                    fontSize: mobile ? 15 : 20,
                    fontWeight: 500,
                    lineHeight: mobile ? 20 : 26,
                    fill: 'var(--fg)',
                    align: label.align ?? 'center',
                  },
                  name: {
                    fontSize: mobile ? 11 : 13,
                    lineHeight: 16,
                    fill: 'var(--fg)',
                    opacity: 0.7,
                    align: label.align ?? 'center',
                  },
                },
              },
            },
          ],
        };
      },
    });

    this.chartOptions = {
      animation: false,
      legend: {
        top: 0,
        padding: 10,
        data: this.regions.map((region) => ({
          name: this.names[region],
          inactiveColor: 'rgb(110, 112, 121)',
          textStyle: {
            color: 'var(--fg)',
          },
          icon: 'roundRect',
        })),
        selected: this.legendSelected,
      },
      tooltip: {
        show: true,
        trigger: 'item',
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: 'var(--tooltip-grey)',
          align: 'left',
        },
        borderColor: '#000',
        formatter: (params): string => {
          const region = this.regions[params.seriesIndex];
          let tooltip = `<b style="color: white; margin-left: 2px">${this.names[region]}</b><br>`;
          for (const m of METRICS) {
            const line = `${this.metricNames[m]}: ${this.formatValue(
              this.shares[region][m],
              m
            )} (${this.formatPercent(this.percents[region][m])})`;
            tooltip +=
              (m === metric ? `<b style="color: white">${line}</b>` : line) +
              '<br>';
          }
          return tooltip;
        },
      },
      series: this.regions.map(regionSeries),
    };
  }

  onChartInit(ec): void {
    this.chartInstance = ec;
    this.chartInstance.on('legendselectchanged', (e) => {
      this.storageService.setValue(
        LEGEND_STORAGE_KEY,
        JSON.stringify(e.selected)
      );
      this.zone.run(() => {
        this.legendSelected = e.selected;
        // onSaveChart() re-applies chartOptions, so it must carry the current selection
        (
          this.chartOptions.legend as { selected: Record<string, boolean> }
        ).selected = e.selected;
        this.cd.markForCheck();
      });
    });
    this.chartInstance.on('mouseover', (e) =>
      this.setHoveredRegion(this.regions[e.seriesIndex])
    );
    this.chartInstance.on('mouseout', () => this.setHoveredRegion(null));
  }

  setHoveredRegion(region: Region | null): void {
    this.zone.run(() => {
      this.hoveredRegion = region;
      this.cd.markForCheck();
    });
  }

  onRowHover(region: Region, hovered: boolean): void {
    this.hoveredRegion = hovered ? region : null;
    this.chartInstance?.dispatchAction({
      type: hovered ? 'highlight' : 'downplay',
      seriesIndex: this.regions.indexOf(region),
    });
  }

  onSaveChart(): void {
    const now = new Date();
    this.chartOptions.backgroundColor = 'var(--active-bg)';
    this.chartInstance.setOption(this.chartOptions);
    download(
      this.chartInstance.getDataURL({
        pixelRatio: 2,
      }),
      `lightning-network-shares-${this.metric}-${Math.round(
        now.getTime() / 1000
      )}.svg`
    );
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }

  ngOnDestroy(): void {
    this.fragmentSubscription?.unsubscribe();
  }
}
