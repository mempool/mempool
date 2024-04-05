import { Component, OnInit, Input, OnDestroy, OnChanges, SimpleChanges, HostListener, ChangeDetectorRef } from '@angular/core';
import { Subscription, catchError, of, tap } from 'rxjs';
import { StorageService } from '../../services/storage.service';
import { Transaction } from '../../interfaces/electrs.interface';
import { nextRoundNumber } from '../../shared/common.utils';
import { ServicesApiServices } from '../../services/services-api.service';
import { AudioService } from '../../services/audio.service';
import { StateService } from '../../services/state.service';

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
export class AcceleratePreviewComponent implements OnDestroy, OnChanges {
  @Input() tx: Transaction | undefined;
  @Input() scrollEvent: boolean;

  math = Math;
  error = '';
  showSuccess = false;
  estimateSubscription: Subscription;
  accelerationSubscription: Subscription;
  estimate: any;
  hasAncestors: boolean = false;
  minExtraCost = 0;
  minBidAllowed = 0;
  maxBidAllowed = 0;
  defaultBid = 0;
  maxCost = 0;
  userBid = 0;
  selectFeeRateIndex = 1;
  isMobile: boolean = window.innerWidth <= 767.98;
  user: any = undefined;

  maxRateOptions: RateOption[] = [];

  // Cashapp payment
  paymentType: 'bitcoin' | 'cashapp' = 'bitcoin';
  cashAppSubscription: Subscription;
  conversionsSubscription: Subscription;
  payments: any;
  showSpinner = false;
  square: any;
  cashAppPay: any;
  hideCashApp = false;

  constructor(
    public stateService: StateService,
    private servicesApiService: ServicesApiServices,
    private storageService: StorageService,
    private audioService: AudioService,
    private cd: ChangeDetectorRef
  ) {
    if (window.document.referrer === 'cash.app') {
      this.insertSquare();
      this.paymentType = 'cashapp';
    } else {
      this.paymentType = 'bitcoin';
    }
  }

  ngOnDestroy(): void {
    if (this.estimateSubscription) {
      this.estimateSubscription.unsubscribe();
    }
    if (this.cashAppPay) {
      this.cashAppPay.destroy();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.scrollEvent) {
      this.scrollToPreview('acceleratePreviewAnchor', 'start');
    }
  }

  ngAfterViewInit() {
    this.showSpinner = true;

    this.user = this.storageService.getAuth()?.user ?? null;

    this.servicesApiService.setupSquare$().subscribe(ids => {
      this.square = {
        appId: ids.squareAppId,
        locationId: ids.squareLocationId
      };
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

            if (this.paymentType === 'cashapp') {
              this.estimate.userBalance = 999999999;
              this.estimate.enoughBalance = true;
            }

            if (this.estimate.hasAccess === true && this.estimate.userBalance <= 0) {
              if (this.isLoggedIn()) {
                this.error = `not_enough_balance`;
                this.scrollToPreviewWithTimeout('mempoolError', 'center');
              }
            }

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
              if (this.paymentType === 'cashapp') {
                this.setupSquare();
              } 
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
    });
  }

  /**
   * User changed his bid
   */
  setUserBid({ fee, index }: { fee: number, index: number}) {
    if (this.estimate) {
      this.selectFeeRateIndex = index;
      this.userBid = Math.max(0, fee);
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
  accelerate() {
    if (this.accelerationSubscription) {
      this.accelerationSubscription.unsubscribe();
    }
    this.accelerationSubscription = this.servicesApiService.accelerate$(
      this.tx.txid,
      this.userBid
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

  isLoggedIn() {
    const auth = this.storageService.getAuth();
    return auth !== null;
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.isMobile = window.innerWidth <= 767.98;
  }

  /**
   * CashApp payment
   */
  setupSquare() {
    const init = () => {
      this.initSquare();
    };

    //@ts-ignore
    if (!window.Square) {
      console.warn('Square.js failed to load properly. Retrying in 1 second.');
      setTimeout(init, 1000);
    } else {
      init();
    }
  }

  async initSquare(): Promise<void> {
    try {
      //@ts-ignore
      this.payments = window.Square.payments(this.square.appId, this.square.locationId)
      await this.requestCashAppPayment();
    } catch (e) {
      console.error(e);
      this.error = 'Error loading Square Payments';
      return;
    }
  }

  async requestCashAppPayment() {
    if (this.cashAppSubscription) {
      this.cashAppSubscription.unsubscribe();
    }
    if (this.conversionsSubscription) {
      this.conversionsSubscription.unsubscribe();
    }
    this.hideCashApp = false;

    
    this.conversionsSubscription = this.stateService.conversions$.subscribe(
      async (conversions) => {
        const maxCostUsd = this.maxCost / 100_000_000 * conversions.USD;
        const paymentRequest = this.payments.paymentRequest({
          countryCode: 'US',
          currencyCode: 'USD',
          total: {
            amount: maxCostUsd.toString(),
            label: 'Total',
            pending: true,
            productUrl: `https://mempool.space/tx/${this.tx.txid}`,
          }
        });
        this.cashAppPay = await this.payments.cashAppPay(paymentRequest, {
          redirectURL: `https://mempool.space/tx/${this.tx.txid}`,
          referenceId: `accelerator-${this.tx.txid.substring(0, 15)}-${Math.round(new Date().getTime() / 1000)}`,
        });
        await this.cashAppPay.attach('#cash-app-pay');
        this.showSpinner = false;
        
        const that = this;
        this.cashAppPay.addEventListener('ontokenization', function (event) {
          const { tokenResult, error } = event.detail;
          if (error) {
            this.error = error;
          } else if (tokenResult.status === 'OK') {
            that.hideCashApp = true;

            that.accelerationSubscription = that.servicesApiService.accelerateWithCashApp$(
              that.tx.txid,
              that.userBid,
              tokenResult.token,
              tokenResult.details.cashAppPay.cashtag,
              tokenResult.details.cashAppPay.referenceId
            ).subscribe({
              next: () => {
                that.audioService.playSound('ascend-chime-cartoon');
                that.showSuccess = true;
                that.scrollToPreviewWithTimeout('successAlert', 'center');
                that.estimateSubscription.unsubscribe();
              },
              error: (response) => {
                if (response.status === 403 && response.error === 'not_available') {
                  that.error = 'waitlisted';
                } else {
                  that.error = response.error;
                }
                that.scrollToPreviewWithTimeout('mempoolError', 'center');
              }
            });
          }
        });
      }
    );
  }

  insertSquare(): void {
    let statsUrl = 'https://sandbox.web.squarecdn.com/v1/square.js';
    if (document.location.hostname === 'mempool-staging.tk7.mempool.space' || document.location.hostname === 'mempool.space') {
      statsUrl = 'https://web.squarecdn.com/v1/square.js';
    }

    (function() {
      const d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
      // @ts-ignore
      g.type='text/javascript'; g.src=statsUrl; s.parentNode.insertBefore(g, s);
    })();
  }
}
