import { ChangeDetectionStrategy, Component, Inject, LOCALE_ID, Input, NgZone, OnChanges, SimpleChanges, ChangeDetectorRef, EventEmitter, Output } from '@angular/core';
import { Router } from '@angular/router';
import { EChartsOption, PieSeriesOption } from '@app/graphs/echarts';
import { BehaviorSubject, combineLatest, Observable, Subscription } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { download } from '@app/shared/graphs.utils';
import { isMobile } from '@app/shared/common.utils';
import { WalletStats } from '@app/shared/wallet-stats';
import { AddressTxSummary } from '@interfaces/electrs.interface';
import { chartColors } from '@app/app.constants';
import { formatNumber } from '@angular/common';

@Component({
  selector: 'app-treasuries-pie',
  templateUrl: './treasuries-pie.component.html',
  styleUrls: ['./treasuries-pie.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreasuriesPieComponent implements OnChanges {
  @Input() height: number = 300;
  @Input() mode: 'relative' | 'all' = 'relative';
  @Input() walletStats: Record<string, WalletStats>;
  @Input() walletSummaries$: Observable<Record<string, AddressTxSummary[]>>;
  @Input() selectedWallets: Record<string, boolean> = {};
  @Input() wallets: string[] = [];
  @Output() navigateToWallet: EventEmitter<string> = new EventEmitter();

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };
  chartInstance: any = undefined;
  error: any;
  isLoading = true;
  subscription: Subscription;
  redraw$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  walletBalance: Record<string, number> = {};

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    public stateService: StateService,
    private router: Router,
    private zone: NgZone,
    private cd: ChangeDetectorRef,
  ) {
  }

  ngOnInit(): void {
    this.isLoading = true;
    this.setupSubscription();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.walletSummaries$ || changes.selectedWallets || changes.mode) {
      if (this.subscription) {
        this.subscription.unsubscribe();
      }
      this.setupSubscription();
    } else {
      // re-trigger subscription
      this.redraw$.next(true);
    }
  }

  setupSubscription(): void {
    this.subscription = combineLatest([
      this.redraw$,
      this.walletSummaries$
    ]).subscribe(([_, walletSummaries]) => {
      if (walletSummaries) {
        this.error = null;
        this.processWalletData(walletSummaries);
        this.prepareChartOptions();
      }
      this.isLoading = false;
      this.cd.markForCheck();
    });
  }

  processWalletData(walletSummaries: Record<string, AddressTxSummary[]>): void {
    this.walletBalance = {};

    Object.entries(walletSummaries).forEach(([walletId, summary]) => {
      if (summary?.length) {
        const total = this.walletStats[walletId] ? this.walletStats[walletId].balance : summary.reduce((acc, tx) => acc + tx.value, 0);
        this.walletBalance[walletId] = total;
      }
    });
  }

  generateChartSeriesData(): PieSeriesOption[] {
    let sliceThreshold = 1;
    if (isMobile()) {
      sliceThreshold = 2;
    }

    const data: object[] = [];

    let edgeDistance: any = '20%';
    if (isMobile()) {
      edgeDistance = 0;
    } else {
      edgeDistance = 10;
    }

    const treasuriesTotal = Object.values(this.walletBalance).reduce((acc, v) => acc + v, 0);
    const total = this.mode === 'relative' ? treasuriesTotal : 2099999997690000;

    const entries = this.wallets.map((id, index) => ({
      id,
      balance: this.walletBalance[id],
      share: (this.walletBalance[id] / total) * 100,
      color: chartColors[index % chartColors.length],
    }));
    if (this.mode === 'all') {
      entries.unshift({
        id: 'remaining',
        balance: (total - treasuriesTotal),
        share: ((total - treasuriesTotal) / total) * 100,
        color: 'orange'
      });

      console.log('ALL! ', entries);
    }

    const otherEntry = { id: 'other', balance: 0, share: 0 };

    entries.forEach((entry) => {
      if (entry.share < sliceThreshold) {
        otherEntry.balance += entry.balance;
        otherEntry.share = (otherEntry.balance / total) * 100;
        return;
      }
      data.push({
        itemStyle: {
          color: entry.color,
        },
        value: entry.share,
        name: entry.id,
        label: {
          overflow: 'none',
          color: 'var(--tooltip-grey)',
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
            return `<b style="color: white">${entry.id} (${entry.share.toFixed(2)}%)</b><br>
            ${formatNumber(entry.balance / 100_000_000, this.locale, '1.3-3')} BTC<br>`;
          }
        },
        data: entry.id as any,
      } as PieSeriesOption);
    });

    const percentage = otherEntry.share.toFixed(2) + '%';

    if (otherEntry.share > 0) {
      data.push({
        itemStyle: {
          color: '#6b6b6b',
        },
        value: otherEntry.share,
        name:  $localize`Other (${percentage})`,
        label: {
          overflow: 'none',
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
            return `<b style="color: white">${otherEntry.id} (${otherEntry.share}%)</b><br>
            ${formatNumber(otherEntry.balance, this.locale, '1.3-3')}<br>`;
          }
        },
        data: 9999 as any,
      } as PieSeriesOption);
    }

    return data;
  }

  prepareChartOptions(): void {
    const pieSize = ['20%', '80%']; // Desktop

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
          minShowLabelAngle: 1.8,
          name: 'Treasuries',
          type: 'pie',
          radius: pieSize,
          data: this.generateChartSeriesData(),
          labelLine: {
            lineStyle: {
              width: 2,
            },
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
                width: 3,
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
      if (e.data.data === 9999) { // "Other"
        return;
      }
      this.navigateToWallet.emit(e.data.data);
    });
  }

  onSaveChart(): void {
    const now = new Date();
    this.chartOptions.backgroundColor = 'var(--active-bg)';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `treasuries-pie-${Math.round(now.getTime() / 1000)}.svg`);
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }

  isEllipsisActive(e: HTMLElement): boolean {
    return (e.offsetWidth < e.scrollWidth);
  }
}

