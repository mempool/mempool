import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, Inject, Input, LOCALE_ID, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { combineLatest, map, Observable, startWith, Subscription, tap } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { WalletStats } from '../../../shared/wallet-stats';
import { AddressTxSummary } from '../../../interfaces/electrs.interface';
import { Treasury } from '../../../interfaces/node-api.interface';


interface VerifyShare {
  share: number;
  btc: number;
  x: string;
  w: string;
  label: string;
  type: string;
}

@Component({
  selector: 'app-treasuries-verify-progress',
  templateUrl: './treasuries-verify.component.html',
  styleUrls: ['./treasuries-verify.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreasuriesVerifyProgressComponent implements OnInit, OnDestroy {
  @Input() walletStats: Record<string, WalletStats>;
  @Input() treasuries: Treasury[] = [];
  @Input() showTitle = true;

  loading = true;
  isMobile: boolean;

  walletBalance: Record<string, number> = {};

  @ViewChild('verifySvg') verifySvgElement: ElementRef<SVGElement>;
  @ViewChild('tooltip') tooltipElement: ElementRef<HTMLCanvasElement>;

  isLoadingWebSocket$: Observable<boolean>;
  subscription: Subscription;

  currentHeight: number;
  shares: VerifyShare[];

  verifiedTotalAddresses: number;
  percentVerified: number;
  verifiedTotalBtc: number;

  tooltipPosition = { x: 0, y: 0 };
  hoverSection: VerifyShare | void;

  constructor(
    public stateService: StateService,
    private cd: ChangeDetectorRef,
    @Inject(LOCALE_ID) private locale: string,
  ) { }

  ngOnInit(): void {
    this.isLoadingWebSocket$ = this.stateService.isLoadingWebSocket$;
    this.init();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.treasuries || changes.walletStats) {
      this.init();
    }
  }

  init(): void {
    if (this.treasuries && this.walletStats) {
      this.subscription?.unsubscribe();
      this.subscription = this.stateService.chainTip$.pipe(
        startWith(this.stateService.latestBlockHeight),
      ).subscribe((chainTip) => {
        this.currentHeight = chainTip;
        this.processVerifyShares();
      });
    }
  }

  processVerifyShares(): void {
    let total = 0;
    let publicTotal = 0;
    let verifiedTotal = 0;
    this.verifiedTotalAddresses = 0;

    for (const treasury of this.treasuries) {
      const walletStats = this.walletStats[treasury.wallet];
      if (walletStats) {
        for (const address of walletStats.addresses) {
          const stats = walletStats.addressStats[address];
          if (stats) {
            const addressBalance = (stats.funded_txo_sum - stats.spent_txo_sum) / 100_000_000;
            if (treasury.verifiedAddresses?.includes(address)) {
              verifiedTotal += addressBalance;
            }
            if (address !== 'private') {
              publicTotal += addressBalance;
            }
            total += addressBalance;
          }
        }
      }
      this.verifiedTotalAddresses += treasury.verifiedAddresses?.length || 0;
    }

    this.percentVerified = (verifiedTotal / total) * 100;
    this.verifiedTotalBtc = verifiedTotal;

    // calculate share of total verify for each treasury
    this.shares = [
      {
        share: 1,
        btc: total,
        x: '0',
        w: '100%',
        label: 'All Treasuries',
        type: 'treasuries',
      },
      {
        share: (publicTotal / total),
        btc: publicTotal,
        x: '0',
        w: ((publicTotal / total) * 100).toFixed(2) + '%',
        label: 'Public Holdings',
        type: 'public',
      },
      {
        share: (verifiedTotal / total),
        btc: verifiedTotal,
        x: '0',
        w: ((verifiedTotal / total) * 100).toFixed(2) + '%',
        label: 'Verified Holdings',
        type: 'verified',
      }
    ];
    this.loading = false;
  }

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event): void {
    if (this.verifySvgElement?.nativeElement?.contains(event.target)) {
      this.onPointerMove(event);
      event.preventDefault();
    }
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event): void {
    if (this.verifySvgElement?.nativeElement?.contains(event.target)) {
      let x = event.clientX;
      const y = event.clientY - 100;
      if (this.tooltipElement) {
        const elementBounds = this.tooltipElement.nativeElement.getBoundingClientRect();
        x -= elementBounds.width / 2;
        x = Math.min(Math.max(x, 20), (window.innerWidth - 20 - elementBounds.width));
      }
      this.tooltipPosition = { x, y };
      this.cd.markForCheck();
    }
  }

  onHover(_, share: VerifyShare): void {
    this.hoverSection = share;
  }

  onBlur(): void {
    this.hoverSection = undefined;
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.isMobile = window.innerWidth <= 767.98;
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
