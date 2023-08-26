import { Component, OnInit, Input, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { Subscription, catchError, of, tap } from 'rxjs';

export type AccelerationEstimate = {
  txSummary: TxSummary;
  nextBlockFee: number;
  targetFeeRate: number;
  userBalance: number;
  enoughBalance: boolean;
  cost: number;
  mempoolBaseFee: number;
  vsizeFee: number;
}
export type TxSummary = {
  txid: string; // txid of the current transaction
  effectiveVsize: number; // Total vsize of the dependency tree
  effectiveFee: number;  // Total fee of the dependency tree in sats
  ancestorCount: number; // Number of ancestors
}

export const DEFAULT_BID_RATIO = 5;
export const MIN_BID_RATIO = 2;
export const MAX_BID_RATIO = 20;

@Component({
  selector: 'app-accelerate-preview',
  templateUrl: 'accelerate-preview.component.html',
  styleUrls: ['accelerate-preview.component.scss']
})
export class AcceleratePreviewComponent implements OnInit, OnDestroy, OnChanges {
  @Input() txid: string | undefined;
  @Input() scrollEvent: boolean;

  math = Math;
  error = '';
  showSuccess = false;
  estimateSubscription: Subscription;
  accelerationSubscription: Subscription;
  estimate: any;
  minExtraCost = 0;
  minBidAllowed = 0;
  maxBidAllowed = 0;
  defaultBid = 0;
  maxCost = 0;
  userBid = 0;
  selectFeeRateIndex = 2;

  constructor(
    private apiService: ApiService
  ) { }

  ngOnDestroy(): void {
    if (this.estimateSubscription) {
      this.estimateSubscription.unsubscribe();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.scrollEvent) {
      this.scrollToPreview('acceleratePreviewAnchor', 'center');
    }
  }

  ngOnInit() {
    this.estimateSubscription = this.apiService.estimate$(this.txid).pipe(
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

          if (this.estimate.userBalance <= 0) {
            this.error = `not_enough_balance`;
            this.scrollToPreviewWithTimeout('mempoolError', 'center');
          }
          
          // Make min extra fee at least 50% of the current tx fee
          this.minExtraCost = Math.max(this.estimate.cost, this.estimate.txSummary.effectiveFee / 2);
          this.minExtraCost = Math.round(this.minExtraCost);

          this.minBidAllowed = this.minExtraCost * MIN_BID_RATIO;
          this.maxBidAllowed = this.minExtraCost * MAX_BID_RATIO;
          this.defaultBid = this.minExtraCost * DEFAULT_BID_RATIO;

          this.userBid = this.defaultBid;
          if (this.userBid < this.minBidAllowed) {
            this.userBid = this.minBidAllowed;
          } else if (this.userBid > this.maxBidAllowed) {
            this.userBid = this.maxBidAllowed;
          }            
          this.maxCost = this.userBid + this.estimate.mempoolBaseFee + this.estimate.vsizeFee;

          if (!this.error) {
            this.scrollToPreview('acceleratePreviewAnchor', 'center');
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
  setUserBid(multiplier: number, index: number) {
    if (this.estimate) {
      this.selectFeeRateIndex = index;
      this.userBid = Math.max(0, this.minExtraCost * multiplier);
      this.maxCost = this.userBid + this.estimate.mempoolBaseFee + this.estimate.vsizeFee;
    }
  }

  /**
   * Scroll to element id with or without setTimeout
   */
  scrollToPreviewWithTimeout(id: string, position: ScrollLogicalPosition) {
    setTimeout(() => {
      this.scrollToPreview(id, position);
    }, 100);
  }
  scrollToPreview(id: string, position: ScrollLogicalPosition) {
    const acceleratePreviewAnchor = document.getElementById(id);
    if (acceleratePreviewAnchor) {
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
  accelerate() {
    if (this.accelerationSubscription) {
      this.accelerationSubscription.unsubscribe();
    }
    this.accelerationSubscription = this.apiService.accelerate$(
      this.txid,
      this.userBid
    ).subscribe({
      next: () => {
        this.showSuccess = true;
        this.scrollToPreviewWithTimeout('successAlert', 'center');
        this.estimateSubscription.unsubscribe();
      },
      error: (response) => {
        this.error = response.error;
        this.scrollToPreviewWithTimeout('mempoolError', 'center');
      }
    });
  }
}