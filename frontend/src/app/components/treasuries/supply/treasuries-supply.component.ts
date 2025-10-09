import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, Inject, Input, LOCALE_ID, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { combineLatest, map, Observable, startWith, Subscription } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { WalletStats } from '../../../shared/wallet-stats';
import { AddressTxSummary } from '../../../interfaces/electrs.interface';
import { Treasury } from '../../../interfaces/node-api.interface';


interface SupplyShare {
  share: number;
  btc: number;
  x: string;
  w: string;
  label: string;
  type: string;
}

@Component({
  selector: 'app-treasuries-supply',
  templateUrl: './treasuries-supply.component.html',
  styleUrls: ['./treasuries-supply.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreasuriesSupplyComponent implements OnInit, OnDestroy {
  @Input() walletStats: Record<string, WalletStats>;
  @Input() walletSummaries$: Observable<Record<string, AddressTxSummary[]>>;
  @Input() treasuries: Treasury[] = [];
  @Input() showTitle = true;

  loadingTreasurySupply = true;
  isMobile: boolean;

  walletBalance: Record<string, number> = {};

  @ViewChild('supplySvg') supplySvgElement: ElementRef<SVGElement>;
  @ViewChild('tooltip') tooltipElement: ElementRef<HTMLCanvasElement>;

  isLoadingWebSocket$: Observable<boolean>;
  subscription: Subscription;

  currentHeight: number;
  shares: SupplyShare[];

  totalTreasuries: number;
  percentSupply: number;
  toBeMined: number;

  tooltipPosition = { x: 0, y: 0 };
  hoverSection: SupplyShare | void;

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
    if (changes.walletSummaries$ || changes.treasuries || changes.walletStats) {
      this.init();
    }
  }

  init(): void {
    if (this.walletSummaries$ && this.treasuries && this.walletStats) {
      this.subscription?.unsubscribe();
      this.subscription = combineLatest([this.stateService.chainTip$.pipe(startWith(this.stateService.latestBlockHeight)), this.walletSummaries$]).pipe(
        map(([chainTip, summaries]) => {
          this.currentHeight = chainTip;
          this.walletBalance = {};
          for (const treasury of this.treasuries) {
            const total = this.walletStats[treasury.wallet] ? this.walletStats[treasury.wallet].balance : summaries[treasury.wallet]?.reduce((acc, tx) => acc + tx.value, 0) || 0;
            this.walletBalance[treasury.wallet] = total / 100_000_000;
          }
          this.processSupplyShares();
        })
      ).subscribe();
    }
  }

  processSupplyShares(): void {
    const total = 20999999.9769;

    // calculate total mined based on block height & subsidy schedule
    let mined = 0;
    for (let i = 0; i < this.currentHeight; i += 210000) {
      const subsidy = 50 / Math.pow(2, Math.floor(i / 210000));
      if ((i + 210000) <= this.currentHeight) {
        mined += subsidy * 210000;
      } else {
        mined += subsidy * (this.currentHeight - i);
      }
    }

    const lost = 0; // TODO: track this dynamically
    const treasuryTotal = Object.values(this.walletBalance).reduce((acc, balance) => acc + balance, 0);
    const otherMined = mined - treasuryTotal - lost;
    const yetToBeMined = total - mined;

    this.totalTreasuries = treasuryTotal;
    this.percentSupply = (treasuryTotal / total) * 100;
    this.toBeMined = yetToBeMined;

    // calculate share of total supply for each treasury
    this.shares = [];
    let runningTotal = 0;
    this.shares.push({
      share: (treasuryTotal / total),
      btc: treasuryTotal,
      x: ((runningTotal / total) * 100).toFixed(2) + '%',
      w: ((treasuryTotal / total) * 100).toFixed(2) + '%',
      label: 'Treasuries',
      type: 'treasuries',
    });
    runningTotal += treasuryTotal;
    this.shares.push({
      share: (otherMined / total),
      btc: otherMined,
      x: ((runningTotal / total) * 100).toFixed(2) + '%',
      w: ((otherMined / total) * 100).toFixed(2) + '%',
      label: 'Other mined',
      type: 'mined',
    });
    runningTotal += otherMined;
    this.shares.push({
      share: (yetToBeMined / total),
      btc: yetToBeMined,
      x: ((runningTotal / total) * 100).toFixed(2) + '%',
      w: ((yetToBeMined / total) * 100).toFixed(2) + '%',
      label: 'Yet to be mined',
      type: 'unmined',
    });
    runningTotal += yetToBeMined;
    this.shares.push({
      share: (lost / total),
      btc: lost,
      x: ((runningTotal / total) * 100).toFixed(2) + '%',
      w: ((lost / total) * 100).toFixed(2) + '%',
      label: 'Lost',
      type: 'lost',
    });
    runningTotal += lost;
    this.loadingTreasurySupply = false;
  }

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event): void {
    if (this.supplySvgElement?.nativeElement?.contains(event.target)) {
      this.onPointerMove(event);
      event.preventDefault();
    }
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event): void {
    if (this.supplySvgElement?.nativeElement?.contains(event.target)) {
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

  onHover(_, share: SupplyShare): void {
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
