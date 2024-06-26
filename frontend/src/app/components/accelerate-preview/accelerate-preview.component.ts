import { Component, OnInit, Input, OnDestroy, OnChanges, SimpleChanges, HostListener, ChangeDetectorRef } from '@angular/core';
import { Observable, Subscription, catchError, of, tap } from 'rxjs';
import { StorageService } from '../../services/storage.service';
import { Transaction } from '../../interfaces/electrs.interface';
import { nextRoundNumber } from '../../shared/common.utils';
import { ServicesApiServices } from '../../services/services-api.service';
import { AudioService } from '../../services/audio.service';
import { StateService } from '../../services/state.service';
import { MiningStats } from '../../services/mining.service';
import { EtaService } from '../../services/eta.service';

export type AccelerationEstimate = {
  txSummary: TxSummary;
  nextBlockFee: number;
  targetFeeRate: number;
  userBalance: number;
  enoughBalance: boolean;
  cost: number;
  mempoolBaseFee: number;
  vsizeFee: number;
  pools: number[]
}
export type TxSummary = {
  txid: string; // txid of the current transaction
  effectiveVsize: number; // Total vsize of the dependency tree
  effectiveFee: number;  // Total fee of the dependency tree in sats
  ancestorCount: number; // Number of ancestors
}

export interface RateOption {
  fee: number;
  rate: number;
  index: number;
}

export const MIN_BID_RATIO = 1;
export const DEFAULT_BID_RATIO = 2;
export const MAX_BID_RATIO = 4;

@Component({
  selector: 'app-accelerate-preview',
  templateUrl: 'accelerate-preview.component.html',
  styleUrls: ['accelerate-preview.component.scss']
})
export class AcceleratePreviewComponent implements OnInit, OnDestroy, OnChanges {
  @Input() tx: Transaction;
  @Input() miningStats: MiningStats;
  @Input() scrollEvent: boolean;
  @Input() showDetails: boolean;

  math = Math;
  error = '';
  showSuccess = false;
  estimateSubscription: Subscription;
  accelerationSubscription: Subscription;
  difficultySubscription: Subscription;
  estimate: any;
  etaInfo$: Observable<{ hashratePercentage: number, ETA: number, acceleratedETA: number }>;
  hasAncestors: boolean = false;
  minExtraCost = 0;
  minBidAllowed = 0;
  maxBidAllowed = 0;
  defaultBid = 0;
  maxCost = 0;
  userBid = 0;
  accelerationUUID: string;
  selectFeeRateIndex = 1;
  isMobile: boolean = window.innerWidth <= 767.98;
  user: any = undefined;

  maxRateOptions: RateOption[] = [];

  constructor(
    public stateService: StateService,
    private servicesApiService: ServicesApiServices,
    private storageService: StorageService,
    private etaService: EtaService,
    private audioService: AudioService,
    private cd: ChangeDetectorRef
  ) {
  }

  ngOnDestroy(): void {
    if (this.estimateSubscription) {
      this.estimateSubscription.unsubscribe();
    }
  }

  ngOnInit(): void {
    this.accelerationUUID = window.crypto.randomUUID();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.scrollEvent) {
      this.scrollToPreview('acceleratePreviewAnchor', 'start');
    }
  }

  ngAfterViewInit(): void {
    this.user = this.storageService.getAuth()?.user ?? null;

    this.estimateSubscription = this.servicesApiService.estimate$(this.tx.txid).pipe(
      tap((response) => {
        if (response.status === 204) {
          this.estimate = undefined;
          this.error = `cannot_accelerate_tx`;
          this.scrollToPreviewWithTimeout('mempoolError', 'center');
          this.estimateSubscription.unsubscribe();
        } else {
          this.estimate = response.body;
          if (!this.estimate) {
            this.error = `cannot_accelerate_tx`;
            this.scrollToPreviewWithTimeout('mempoolError', 'center');
            this.estimateSubscription.unsubscribe();
          }

          if (this.estimate.hasAccess === true && this.estimate.userBalance <= 0) {
            if (this.isLoggedIn()) {
              this.error = `not_enough_balance`;
              this.scrollToPreviewWithTimeout('mempoolError', 'center');
            }
          }

          this.etaInfo$ = this.etaService.getProjectedEtaObservable(this.estimate, this.miningStats);

          this.hasAncestors = this.estimate.txSummary.ancestorCount > 1;
          
          // Make min extra fee at least 50% of the current tx fee
          this.minExtraCost = nextRoundNumber(Math.max(this.estimate.cost * 2, this.estimate.txSummary.effectiveFee));

          this.maxRateOptions = [1, 2, 4].map((multiplier, index) => {
            return {
              fee: this.minExtraCost * multiplier,
              rate: (this.estimate.txSummary.effectiveFee + (this.minExtraCost * multiplier)) / this.estimate.txSummary.effectiveVsize,
              index,
            };
          });

          this.minBidAllowed = this.minExtraCost * MIN_BID_RATIO;
          this.defaultBid = this.minExtraCost * DEFAULT_BID_RATIO;
          this.maxBidAllowed = this.minExtraCost * MAX_BID_RATIO;

          this.userBid = this.defaultBid;
          if (this.userBid < this.minBidAllowed) {
            this.userBid = this.minBidAllowed;
          } else if (this.userBid > this.maxBidAllowed) {
            this.userBid = this.maxBidAllowed;
          }            
          this.maxCost = this.userBid + this.estimate.mempoolBaseFee + this.estimate.vsizeFee;

          if (!this.error) {
            this.scrollToPreview('acceleratePreviewAnchor', 'start');

            setTimeout(() => {
              this.onScroll();
            }, 100);
          }
        }
      }),
      catchError((response) => {
        this.estimate = undefined;
        this.error = response.error;
        this.scrollToPreviewWithTimeout('mempoolError', 'center');
        this.estimateSubscription.unsubscribe();
        return of(null);
      })
    ).subscribe();
  }

  /**
   * User changed his bid
   */
  setUserBid({ fee, index }: { fee: number, index: number}): void {
    if (this.estimate) {
      this.selectFeeRateIndex = index;
      this.userBid = Math.max(0, fee);
      this.maxCost = this.userBid + this.estimate.mempoolBaseFee + this.estimate.vsizeFee;
    }
  }

  /**
   * Scroll to element id with or without setTimeout
   */
  scrollToPreviewWithTimeout(id: string, position: ScrollLogicalPosition): void {
    setTimeout(() => {
      this.scrollToPreview(id, position);
    }, 100);
  }
  scrollToPreview(id: string, position: ScrollLogicalPosition): void {
    const acceleratePreviewAnchor = document.getElementById(id);
    if (acceleratePreviewAnchor) {
      this.cd.markForCheck();
      acceleratePreviewAnchor.scrollIntoView({
        behavior: 'smooth',
        inline: position,
        block: position,
      });
    }
  }

  /**
   * Send acceleration request
   */
  accelerate(): void {
    if (this.accelerationSubscription) {
      this.accelerationSubscription.unsubscribe();
    }
    this.accelerationSubscription = this.servicesApiService.accelerate$(
      this.tx.txid,
      this.userBid,
      this.accelerationUUID
    ).subscribe({
      next: () => {
        this.audioService.playSound('ascend-chime-cartoon');
        this.showSuccess = true;
        this.scrollToPreviewWithTimeout('successAlert', 'center');
        this.estimateSubscription.unsubscribe();
      },
      error: (response) => {
        if (response.status === 403 && response.error === 'not_available') {
          this.error = 'waitlisted';
        } else {
          this.error = response.error;
        }
        this.scrollToPreviewWithTimeout('mempoolError', 'center');
      }
    });
  }

  isLoggedIn(): boolean {
    const auth = this.storageService.getAuth();
    return auth !== null;
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.isMobile = window.innerWidth <= 767.98;
  }


  @HostListener('window:scroll', ['$event']) // for window scroll events
  onScroll(): void {
    if (this.estimate) {
      setTimeout(() => {
        this.onScroll();
      }, 200);
      return;
    }
  }
}
