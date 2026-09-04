import { ChangeDetectionStrategy, Component, HostBinding, NgZone, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EChartsOption, PieSeriesOption } from '@app/graphs/echarts';
import { merge, Observable, Subscription } from 'rxjs';
import { startWith, switchMap, shareReplay, tap } from 'rxjs/operators';
import { SeoService } from '@app/services/seo.service';
import { StorageService } from '@app/services/storage.service';
import { MiningService, MiningStats } from '@app/services/mining.service';
import { SinglePoolStats } from '@interfaces/node-api.interface';
import { StateService } from '@app/services/state.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { download, lerpColor } from '@app/shared/graphs.utils';
import { isMobile } from '@app/shared/common.utils';

// Windows longer than 6m would average in the blocks mined before any pool had adopted
// BIP-54, which reads as "adoption" but isn't.
const WINDOWS = ['24h', '3d', '1w', '1m', '3m', '6m'];

const COMPATIBLE_COLORS = ['#43A047', '#C5E1A5'];
const INCOMPATIBLE_COLORS = ['#6b6b6b', '#3d3d3d'];

interface Slice {
  name: string;
  slug: string | null;
  blockCount: number;
  bip54BlockCount: number;
  share: number;
  compatible: boolean;
}

@Component({
  selector: 'app-bip54-coinbase-graph',
  templateUrl: './bip54-coinbase-graph.component.html',
  styleUrls: ['./bip54-coinbase-graph.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Bip54CoinbaseGraphComponent implements OnInit, OnDestroy {
  miningWindowPreference: string;
  radioGroupForm: UntypedFormGroup;

  isLoading = true;
  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };
  timespan = '';
  chartInstance: any = undefined;

  @HostBinding('attr.dir') dir = 'ltr';

  private readonly compatibleLabel = $localize`:@@mining.bip54-compatible:BIP-54 coinbase`;
  private readonly incompatibleLabel = $localize`:@@mining.bip54-incompatible:No BIP-54 coinbase`;

  miningStatsObservable$: Observable<MiningStats>;
  private fragmentSubscription: Subscription;

  constructor(
    public stateService: StateService,
    private storageService: StorageService,
    private formBuilder: UntypedFormBuilder,
    private miningService: MiningService,
    private seoService: SeoService,
    private router: Router,
    private zone: NgZone,
    private route: ActivatedRoute,
  ) {
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@mining.bip54-coinbase-title:BIP-54 Coinbase Adoption`);
    this.seoService.setDescription($localize`:@@meta.description.bitcoin.graphs.bip54-coinbase:See what share of Bitcoin blocks is mined with a coinbase transaction that is forward-compatible with BIP-54, broken down by mining pool.`);

    // the preference is shared with the pools ranking, which offers windows this page doesn't
    const preference = this.miningService.getDefaultTimespan('24h');
    this.miningWindowPreference = WINDOWS.includes(preference) ? preference : '1w';

    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.fragmentSubscription = this.route
      .fragment
      .subscribe((fragment) => {
        if (WINDOWS.indexOf(fragment) > -1) {
          this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
        }
      });

    this.miningStatsObservable$ = merge(
      this.radioGroupForm.get('dateSpan').valueChanges
        .pipe(
          startWith(this.radioGroupForm.controls.dateSpan.value), // (trigger when the page loads)
          tap((value) => {
            this.isLoading = true;
            this.timespan = value;
            this.storageService.setValue('miningWindowPreference', value);
            this.miningWindowPreference = value;
          }),
          switchMap(() => {
            return this.miningService.getMiningStats(this.miningWindowPreference);
          })
        ),
        this.stateService.chainTip$
          .pipe(
            switchMap(() => {
              return this.miningService.getMiningStats(this.miningWindowPreference);
            })
          )
      )
      .pipe(
        tap(data => {
          this.isLoading = false;
          this.prepareChartOptions(data);
        }),
        shareReplay(1)
      );
  }

  /**
   * One slice per pool, sized by its share of the window and coloured by whether the pool
   * currently mines BIP-54 coinbases. Adopters come first so their combined share reads as a
   * single contiguous arc.
   */
  generateChartSeriesData(miningStats: MiningStats): PieSeriesOption[] {
    const compatible: Slice[] = [];
    const incompatible: Slice[] = [];

    for (const pool of miningStats.pools) {
      const slice: Slice = {
        name: pool.name,
        slug: pool.slug,
        blockCount: pool.blockCount,
        bip54BlockCount: pool.bip54BlockCount,
        share: pool.share,
        compatible: this.hasAdoptedBip54(pool),
      };
      (slice.compatible ? compatible : incompatible).push(slice);
    }

    compatible.sort((a, b) => b.blockCount - a.blockCount);
    incompatible.sort((a, b) => b.blockCount - a.blockCount);

    return [
      ...this.groupToSeriesData(compatible),
      ...this.groupToSeriesData(incompatible),
    ];
  }

  /**
   * Answered from the pool's recent blocks rather than the selected window, so a long window
   * reaching back before the pool upgraded doesn't report it as not having adopted. Pools that
   * mined nothing recently fall back to the window itself.
   */
  private hasAdoptedBip54(pool: SinglePoolStats): boolean {
    if (pool.bip54Recent != null) {
      return pool.bip54Recent;
    }
    return pool.blockCount > 0 && pool.bip54BlockCount / pool.blockCount >= 0.5;
  }

  private groupToSeriesData(slices: Slice[]): PieSeriesOption[] {
    const threshold = isMobile() ? 2 : 0.5;
    const kept = slices.filter(slice => slice.share >= threshold);
    const collapsed = slices.filter(slice => slice.share < threshold);

    // sub-threshold pools are bucketed within their own group, never across it, or the
    // compatible / not compatible split would no longer add up
    if (collapsed.length) {
      const compatible = slices[0].compatible;
      kept.push({
        name: compatible ? $localize`:@@mining.bip54-other-compatible:Other (compatible)` : $localize`:@@mining.bip54-other-incompatible:Other (not compatible)`,
        slug: null,
        blockCount: collapsed.reduce((total, slice) => total + slice.blockCount, 0),
        bip54BlockCount: collapsed.reduce((total, slice) => total + slice.bip54BlockCount, 0),
        share: collapsed.reduce((total, slice) => total + slice.share, 0),
        compatible,
      });
    }

    let edgeDistance: any = '20%';
    if (isMobile()) {
      edgeDistance = 10;
    }

    return kept.map((slice, index) => {
      const ramp = slice.compatible ? COMPATIBLE_COLORS : INCOMPATIBLE_COLORS;
      const share = slice.share.toFixed(2);
      return {
        itemStyle: {
          color: lerpColor(ramp[0], ramp[1], kept.length > 1 ? index / (kept.length - 1) : 0),
        },
        value: slice.share,
        name: slice.name + (isMobile() ? `` : ` (${share}%)`),
        label: {
          overflow: 'none',
          color: 'var(--grey)',
          alignTo: 'edge',
          edgeDistance: edgeDistance,
        },
        tooltip: {
          show: !isMobile(),
          backgroundColor: 'rgba(17, 19, 31, 1)',
          borderRadius: 4,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
          textStyle: {
            color: 'var(--tooltip-grey)',
          },
          borderColor: '#000',
          formatter: () => {
            const header = `<b style="color: white">${slice.name} (${share}%)</b><br>`;
            if (!slice.compatible) {
              // no block count here: the line above already says the pool mines none, so a
              // number underneath reads as a BIP-54 count
              return header + this.incompatibleLabel;
            }
            const status = header + this.compatibleLabel + `<br>`;
            const bip54 = slice.bip54BlockCount.toString();
            if (slice.bip54BlockCount === slice.blockCount) {
              return status + $localize`${ bip54 }:INTERPOLATION: blocks`;
            }
            // partial: the pool upgraded partway through this window
            const blocks = slice.blockCount.toString();
            return status + $localize`:@@mining.bip54-blocks-of:${ bip54 }:BIP54_BLOCKS: of ${ blocks }:TOTAL_BLOCKS: blocks`;
          }
        },
        data: slice.slug ?? (9999 as any),
      } as PieSeriesOption;
    });
  }

  prepareChartOptions(miningStats: MiningStats): void {
    let pieSize = ['40%', '75%']; // Desktop
    if (isMobile()) {
      pieSize = ['30%', '60%'];
    }
    // the headline is the combined share of the pools that have adopted, which is what the
    // green arc adds up to
    const adoptedBlockCount = miningStats.pools
      .filter(pool => this.hasAdoptedBip54(pool))
      .reduce((total, pool) => total + pool.blockCount, 0);
    const share = miningStats.blockCount ? (adoptedBlockCount / miningStats.blockCount * 100) : 0;
    const fontSize = isMobile() ? 22 : 30;

    this.chartOptions = {
      animation: false,
      title: {
        text: `${share.toFixed(1)}%`,
        subtext: this.compatibleLabel,
        left: 'center',
        top: 'center',
        itemGap: 0,
        textStyle: {
          fontSize: fontSize,
          lineHeight: fontSize,
          color: COMPATIBLE_COLORS[0],
        },
        subtextStyle: {
          fontSize: isMobile() ? 11 : 13,
          color: 'var(--grey)',
        },
      },
      tooltip: {
        trigger: 'item',
        textStyle: {
          align: 'left',
        }
      },
      legend: {
        top: 'top',
        // a key for now, not a control: toggling would need the shares renormalised
        selectedMode: false,
        data: [
          {
            name: this.compatibleLabel,
            icon: 'roundRect',
            itemStyle: { color: COMPATIBLE_COLORS[0], borderWidth: 0 },
            textStyle: { color: 'var(--fg)' },
          },
          {
            name: this.incompatibleLabel,
            icon: 'roundRect',
            itemStyle: { color: INCOMPATIBLE_COLORS[0], borderWidth: 0 },
            textStyle: { color: 'var(--fg)' },
          },
        ],
      },
      series: [
        {
          // invisible disc filling the donut hole, so hovering the percentage explains
          // where it comes from
          type: 'pie',
          radius: [0, pieSize[0]],
          label: { show: false },
          labelLine: { show: false },
          cursor: 'default',
          itemStyle: { color: 'transparent', borderWidth: 0 },
          emphasis: { scale: false, itemStyle: { color: 'transparent', borderWidth: 0 } },
          data: [{
            value: 1,
            name: '',
            tooltip: {
              show: true,
              backgroundColor: 'rgba(17, 19, 31, 1)',
              borderRadius: 4,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
              textStyle: {
                color: 'var(--tooltip-grey)',
              },
              borderColor: '#000',
              formatter: () => {
                const adopted = adoptedBlockCount.toString();
                const total = miningStats.blockCount.toString();
                return $localize`:@@mining.bip54-summary:Pools that mine a compatible BIP-54 coinbase transaction found ${ adopted }:ADOPTED_BLOCKS: of the ${ total }:TOTAL_BLOCKS: blocks mined in this period.`;
              }
            },
            data: 9999 as any,
          }],
        },
        {
          minShowLabelAngle: 1.8,
          name: 'Mining pool',
          type: 'pie',
          radius: pieSize,
          data: this.generateChartSeriesData(miningStats),
          labelLine: {
            lineStyle: {
              width: 2,
            },
          },
          label: {
            fontSize: 14,
            formatter: (serie) => `${serie.name === 'Binance Pool' ? 'Binance\nPool' : serie.name}`,
          },
          itemStyle: {
            borderRadius: 1,
            borderWidth: 1,
            borderColor: 'var(--bg)',
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 40,
              shadowColor: 'var(--bg)',
            },
            labelLine: {
              lineStyle: {
                width: 3,
              }
            }
          }
        },
        // empty series that exist only to give the two legend entries a name to match:
        // echarts drops legend data that names neither a series nor a data item
        ...[
          { label: this.compatibleLabel, color: COMPATIBLE_COLORS[0] },
          { label: this.incompatibleLabel, color: INCOMPATIBLE_COLORS[0] },
        ].map(entry => ({
          type: 'pie' as const,
          name: entry.label,
          // a pie with no data draws a lightgray placeholder circle that would cover the
          // donut hole, so the stub is sized to nothing and painted transparent
          radius: 0,
          emptyCircleStyle: { color: 'transparent' },
          itemStyle: { color: entry.color },
          data: [],
        })),
      ],
    };
  }

  onChartInit(ec): void {
    if (this.chartInstance !== undefined) {
      return;
    }

    this.chartInstance = ec;
    this.chartInstance.on('click', (e) => {
      if (e.data.data === 9999) { // "Other"
        return;
      }
      this.zone.run(() => {
        const url = new RelativeUrlPipe(this.stateService).transform(`/mining/pool/${e.data.data}`);
        this.router.navigate([url]);
      });
    });
  }

  onSaveChart(): void {
    const now = new Date();
    this.chartOptions.backgroundColor = 'var(--active-bg)';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `bip54-coinbase-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }

  ngOnDestroy(): void {
    this.fragmentSubscription?.unsubscribe();
  }
}
