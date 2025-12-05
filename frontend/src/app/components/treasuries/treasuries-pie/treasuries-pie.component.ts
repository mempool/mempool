import { ChangeDetectionStrategy, Component, Inject, LOCALE_ID, Input, OnChanges, SimpleChanges, ChangeDetectorRef, EventEmitter, Output } from '@angular/core';
import { EChartsOption, PieSeriesOption } from '@app/graphs/echarts';
import { BehaviorSubject, combineLatest, Observable, Subscription } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { download } from '@app/shared/graphs.utils';
import { isMobile } from '@app/shared/common.utils';
import { WalletStats } from '@app/shared/wallet-stats';
import { AddressTxSummary } from '@interfaces/electrs.interface';
import { originalChartColors as chartColors } from '@app/app.constants';
import { formatNumber } from '@angular/common';
import { Treasury } from '@interfaces/node-api.interface';

@Component({
  selector: 'app-treasuries-pie',
  templateUrl: './treasuries-pie.component.html',
  styleUrls: ['./treasuries-pie.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreasuriesPieComponent implements OnChanges {
  @Input() height: number = 300;
  @Input() mode: 'relative' | 'all' = 'relative';
  @Input() walletStats: Record<string, WalletStats>;
  @Input() walletSummaries$: Observable<Record<string, AddressTxSummary[]>>;
  @Input() selectedWallets: Record<string, boolean> = {};
  @Input() treasuries: Treasury[] = [];
  @Output() navigateToTreasury: EventEmitter<Treasury> = new EventEmitter();

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
    for (const treasury of this.treasuries) {
      const summary = walletSummaries[treasury.wallet];
      if (summary?.length) {
        const total = this.walletStats[treasury.wallet] ? this.walletStats[treasury.wallet].balance : summary.reduce((acc, tx) => acc + tx.value, 0);
        this.walletBalance[treasury.wallet] = total;
      }
    }
  }

  generateChartSeriesData(): PieSeriesOption[] {
    let sliceThreshold = 0.5;
    if (isMobile()) {
      sliceThreshold = 1;
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

    const entries: {
      treasury?: any,
      id: string,
      label: string,
      balance: number,
      share: number,
      color: string,
    }[] = this.treasuries.map((treasury, index) => ({
      treasury,
      id: treasury.wallet,
      label: treasury.name || treasury.enterprise || treasury.wallet,
      balance: this.walletBalance[treasury.wallet],
      share: (this.walletBalance[treasury.wallet] / total) * 100,
      color: chartColors[index % chartColors.length],
    }));
    if (this.mode === 'all') {
      entries.unshift({
        id: 'remaining',
        label: 'Remaining',
        balance: (total - treasuriesTotal),
        share: ((total - treasuriesTotal) / total) * 100,
        color: 'orange'
      });
    }

    const otherEntry = { id: 'other', label: 'Other', balance: 0, share: 0 };

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
          formatter: () => {
            return entry.label;
          }
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
            return `<b style="color: white">${entry.label} (${entry.share.toFixed(2)}%)</b><br>
            ${formatNumber(entry.balance / 100_000_000, this.locale, '1.3-3')} BTC<br>`;
          }
        },
        data: entry.treasury,
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
            return `<b style="color: white">${otherEntry.label} (${otherEntry.share.toFixed(2)}%)</b><br>
            ${formatNumber(otherEntry.balance / 100_000_000, this.locale, '1.3-3')} BTC<br>`;
          }
        },
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
      if (!e.data.data) {
        return;
      }
      this.navigateToTreasury.emit(e.data.data);
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

