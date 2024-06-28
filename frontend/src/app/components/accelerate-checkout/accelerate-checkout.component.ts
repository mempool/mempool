import { Component, OnInit, OnDestroy, Output, EventEmitter, Input, ChangeDetectorRef, SimpleChanges, HostListener } from '@angular/core';
import { Subscription, tap, of, catchError, Observable } from 'rxjs';
import { ServicesApiServices } from '../../services/services-api.service';
import { nextRoundNumber } from '../../shared/common.utils';
import { StateService } from '../../services/state.service';
import { AudioService } from '../../services/audio.service';
import { ETA, EtaService } from '../../services/eta.service';
import { Transaction } from '../../interfaces/electrs.interface';
import { MiningStats } from '../../services/mining.service';
import { StorageService } from '../../services/storage.service';

export type PaymentMethod = 'balance' | 'bitcoin' | 'cashapp';

export type AccelerationEstimate = {
  hasAccess: boolean;
  txSummary: TxSummary;
  nextBlockFee: number;
  targetFeeRate: number;
  userBalance: number;
  enoughBalance: boolean;
  cost: number;
  mempoolBaseFee: number;
  vsizeFee: number;
  pools: number[];
  availablePaymentMethods: PaymentMethod[];
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

type CheckoutStep = 'quote' | 'summary' | 'checkout' | 'cashapp' | 'processing';

@Component({
  selector: 'app-accelerate-checkout',
  templateUrl: './accelerate-checkout.component.html',
  styleUrls: ['./accelerate-checkout.component.scss']
})
export class AccelerateCheckout implements OnInit, OnDestroy {
  @Input() tx: Transaction;
  @Input() miningStats: MiningStats;
  @Input() eta: ETA;
  @Input() scrollEvent: boolean;
  @Input() cashappEnabled: boolean = true;
  @Input() advancedEnabled: boolean = false;
  @Input() forceSummary: boolean = false;
  @Input() forceMobile: boolean = false;
  @Output() changeMode = new EventEmitter<boolean>();
  @Output() close = new EventEmitter<null>();

  calculating = true;
  choosenOption: 'wait' | 'accel';
  error = '';
  math = Math;
  isMobile: boolean = window.innerWidth <= 767.98;

  private _step: CheckoutStep = 'summary';
  simpleMode: boolean = true;
  showDetails: boolean = false;
  paymentMethod: 'cashapp' | 'btcpay';

  user: any = undefined;

  // accelerator stuff
  square: { appId: string, locationId: string};
  accelerationUUID: string;
  accelerationSubscription: Subscription;
  difficultySubscription: Subscription;
  estimateSubscription: Subscription;
  estimate: AccelerationEstimate;
  maxBidBoost: number; // sats
  cost: number; // sats
  etaInfo$: Observable<{ hashratePercentage: number, ETA: number, acceleratedETA: number }>;
  showSuccess = false;
  hasAncestors: boolean = false;
  minExtraCost = 0;
  minBidAllowed = 0;
  maxBidAllowed = 0;
  defaultBid = 0;
  userBid = 0;
  selectFeeRateIndex = 1;
  maxRateOptions: RateOption[] = [];

  // square
  loadingCashapp = false;
  cashappSubmit: any;
  payments: any;
  cashAppPay: any;
  cashAppSubscription: Subscription;
  conversionsSubscription: Subscription;
  
  // btcpay
  loadingBtcpayInvoice = false;
  invoice = undefined;

  constructor(
    public stateService: StateService,
    private servicesApiService: ServicesApiServices,
    private storageService: StorageService,
    private etaService: EtaService,
    private audioService: AudioService,
    private cd: ChangeDetectorRef
  ) {
    this.accelerationUUID = window.crypto.randomUUID();
  }

  ngOnInit() {
    this.user = this.storageService.getAuth()?.user ?? null;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('cash_request_id')) { // Redirected from cashapp
      this.moveToStep('processing');
      this.insertSquare();
      this.setupSquare();
    } else if (this.isLoggedIn() || this.forceSummary) {
      this.moveToStep('summary');
    } else {
      this.moveToStep('checkout');
    }

    this.servicesApiService.setupSquare$().subscribe(ids => {
      this.square = {
        appId: ids.squareAppId,
        locationId: ids.squareLocationId
      };
    });
  }

  ngOnDestroy() {
    if (this.estimateSubscription) {
      this.estimateSubscription.unsubscribe();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.scrollEvent) {
      this.scrollToElement('acceleratePreviewAnchor', 'start');
    }
  }

  moveToStep(step: CheckoutStep) {
    this._step = step;
    if (!this.estimate && ['quote', 'summary', 'checkout'].includes(this.step)) {
      this.fetchEstimate();
    }
    if (this._step === 'checkout' && this.canPayWithBitcoin) {
      this.loadingBtcpayInvoice = true;
      this.requestBTCPayInvoice();
    } else if (this._step === 'cashapp' && this.cashappEnabled) {
      this.loadingCashapp = true;
      this.insertSquare();
      this.setupSquare();
    }
  }

  /**
  * Scroll to element id with or without setTimeout
  */
  scrollToElementWithTimeout(id: string, position: ScrollLogicalPosition, timeout: number = 1000): void {
    setTimeout(() => {
      this.scrollToElement(id, position);
    }, timeout);
  }
  scrollToElement(id: string, position: ScrollLogicalPosition) {
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
   * Accelerator
   */
  fetchEstimate() {
    if (this.estimateSubscription) {
      this.estimateSubscription.unsubscribe();
    }
    this.calculating = true;
    this.estimateSubscription = this.servicesApiService.estimate$(this.tx.txid).pipe(
      tap((response) => {
        if (response.status === 204) {
          this.error = `cannot_accelerate_tx`;
        } else {
          this.estimate = response.body;
          if (!this.estimate) {
            this.error = `cannot_accelerate_tx`;
            return;
          }
          if (this.estimate.hasAccess === true && this.estimate.userBalance <= 0) {
            if (this.isLoggedIn()) {
              this.error = `not_enough_balance`;
            }
          }
          this.hasAncestors = this.estimate.txSummary.ancestorCount > 1;
          this.etaInfo$ = this.etaService.getProjectedEtaObservable(this.estimate, this.miningStats);

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
          this.cost = this.userBid + this.estimate.mempoolBaseFee + this.estimate.vsizeFee;

          if (this.step === 'checkout' && this.canPayWithBitcoin && !this.loadingBtcpayInvoice) {
            this.loadingBtcpayInvoice = true;
            this.requestBTCPayInvoice();
          }

          this.calculating = false;
          this.cd.markForCheck();
        }
      }),

      catchError((response) => {
        this.estimate = undefined;
        this.error = `cannot_accelerate_tx`;
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
      this.cost = this.userBid + this.estimate.mempoolBaseFee + this.estimate.vsizeFee;
    }
  }

  /**
   * Advanced mode acceleration button clicked
   */
  accelerate(): void {
    if (this.isLoggedIn()) {
      if (this.step !== 'summary') {
        this.moveToStep('summary');
      } else {
        this.accelerateWithMempoolAccount();
      }
    } else {
      this.moveToStep('checkout');
    }
  }

  /**
   * Account-based acceleration request
   */
  accelerateWithMempoolAccount(): void {
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
        this.estimateSubscription.unsubscribe();
        this.closeModal(2000);
      },
      error: (response) => {
        if (response.status === 403 && response.error === 'not_available') {
          this.error = 'waitlisted';
        } else {
          this.error = response.error;
        }
      }
    });
  }

  /**
   * Square
   */
  insertSquare(): void {
    //@ts-ignore
    if (window.Square) {
      return;
    }
    let statsUrl = 'https://sandbox.web.squarecdn.com/v1/square.js';
    if (document.location.hostname === 'mempool-staging.fmt.mempool.space' ||
        document.location.hostname === 'mempool-staging.va1.mempool.space' ||
        document.location.hostname === 'mempool-staging.fra.mempool.space' ||
        document.location.hostname === 'mempool-staging.tk7.mempool.space' ||
        document.location.hostname === 'mempool.space') {
      statsUrl = 'https://web.squarecdn.com/v1/square.js';
    }

    (function() {
      const d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
      // @ts-ignore
      g.type='text/javascript'; g.src=statsUrl; s.parentNode.insertBefore(g, s);
    })();
  }
  setupSquare() {
    const init = () => {
      this.initSquare();
    };

    //@ts-ignore
    if (!window.Square) {
      console.debug('Square.js failed to load properly. Retrying in 1 second.');
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
      console.debug('Error loading Square Payments', e);
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
    
    this.conversionsSubscription = this.stateService.conversions$.subscribe(
      async (conversions) => {
        if (this.cashAppPay) {
          this.cashAppPay.destroy();
        }

        const redirectHostname = document.location.hostname === 'localhost' ? `http://localhost:4200`: `https://${document.location.hostname}`;
        const costUSD = this.step === 'processing' ? 69.69 : (this.cost / 100_000_000 * conversions.USD); // When we're redirected to this component, the payment data is already linked to the payment token, so does not matter what amonut we put in there, therefore it's 69.69
        const paymentRequest = this.payments.paymentRequest({
          countryCode: 'US',
          currencyCode: 'USD',
          total: {
            amount: costUSD.toString(),
            label: 'Total',
            pending: true,
            productUrl: `${redirectHostname}/tracker/${this.tx.txid}`,
          },
          button: { shape: 'semiround', size: 'small', theme: 'light'}
        });
        this.cashAppPay = await this.payments.cashAppPay(paymentRequest, {
          redirectURL: `${redirectHostname}/tracker/${this.tx.txid}`,
          referenceId: `accelerator-${this.tx.txid.substring(0, 15)}-${Math.round(new Date().getTime() / 1000)}`,
          button: { shape: 'semiround', size: 'small', theme: 'light'}
        });

        if (this.step === 'cashapp') {
          await this.cashAppPay.attach(`#cash-app-pay`, { theme: 'light', size: 'small', shape: 'semiround' })
        }
        this.loadingCashapp = false;

        const that = this;
        this.cashAppPay.addEventListener('ontokenization', function (event) {
          const { tokenResult, error } = event.detail;
          if (error) {
            this.error = error;
          } else if (tokenResult.status === 'OK') {
            that.servicesApiService.accelerateWithCashApp$(
              that.tx.txid,
              tokenResult.token,
              tokenResult.details.cashAppPay.cashtag,
              tokenResult.details.cashAppPay.referenceId,
              that.accelerationUUID
            ).subscribe({
              next: () => {
                that.audioService.playSound('ascend-chime-cartoon');
                if (that.cashAppPay) {
                  that.cashAppPay.destroy();
                }
                setTimeout(() => {
                  that.closeModal();
                  if (window.history.replaceState) {
                    const urlParams = new URLSearchParams(window.location.search);
                    window.history.replaceState(null, null, window.location.toString().replace(`?cash_request_id=${urlParams.get('cash_request_id')}`, ''));
                  }
                }, 1000);
              },
              error: (response) => {
                if (response.status === 403 && response.error === 'not_available') {
                  that.error = 'waitlisted';
                } else {
                  that.error = response.error;
                  setTimeout(() => {
                    // Reset everything by reloading the page :D, can be improved
                    const urlParams = new URLSearchParams(window.location.search);
                    window.location.assign(window.location.toString().replace(`?cash_request_id=${urlParams.get('cash_request_id')}`, ``));
                  }, 3000);
                }
              }
            });
          }
        });
      }
    );
  }

  /**
   * BTCPay
   */
  async requestBTCPayInvoice() {
    this.servicesApiService.generateBTCPayAcceleratorInvoice$(this.tx.txid, this.userBid).subscribe({
      next: (response) => {
        this.invoice = response;
        this.cd.markForCheck();
        this.scrollToElementWithTimeout('acceleratePreviewAnchor', 'start', 500);
      },
      error: (response) => {
        console.log(response);
      }
    });
  }

  /**
   * UI events
   */
  selectedOptionChanged(event) {
    this.choosenOption = event.target.id;
  }
  closeModal(timeout: number = 0): void {
    setTimeout(() => {
      this._step = 'processing';
      this.cd.markForCheck();
      this.close.emit();
    }, timeout);
  }

  isLoggedIn(): boolean {
    const auth = this.storageService.getAuth();
    return auth !== null;
  }

  get step() {
    return this._step;
  }

  get canPayWithBitcoin() {
    return this.estimate?.availablePaymentMethods?.includes('bitcoin');
  }

  get canPayWithCashapp() {
    return this.cashappEnabled && this.estimate?.availablePaymentMethods?.includes('bitcoin');
  }

  get canPayWithBalance() {
    return this.isLoggedIn() && this.estimate?.availablePaymentMethods?.includes('balance');
  }

  get showSummary() {
    return this.canPayWithBalance || this.forceSummary;
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.isMobile = window.innerWidth <= 767.98;
  }
}
