import { Component, OnInit, OnDestroy, Output, EventEmitter, Input, ChangeDetectorRef, SimpleChanges } from '@angular/core';
import { Subscription, tap, of, catchError, Observable } from 'rxjs';
import { ServicesApiServices } from '../../services/services-api.service';
import { nextRoundNumber } from '../../shared/common.utils';
import { StateService } from '../../services/state.service';
import { AudioService } from '../../services/audio.service';
import { AccelerationEstimate } from '../accelerate-preview/accelerate-preview.component';
import { ETA, EtaService } from '../../services/eta.service';
import { Transaction } from '../../interfaces/electrs.interface';
import { MiningStats } from '../../services/mining.service';

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
  @Input() cashappEnabled: boolean;
  @Input() isTracker: boolean = false;
  @Output() close = new EventEmitter<null>();

  calculating = true;
  choosenOption: 'wait' | 'accelerate';
  error = '';

  step: 'paymentMethod' | 'cta' | 'checkout' | 'processing' = 'cta';
  paymentMethod: 'cashapp' | 'btcpay';

  // accelerator stuff
  square: { appId: string, locationId: string};
  accelerationUUID: string;
  estimateSubscription: Subscription;
  estimate: AccelerationEstimate;
  maxBidBoost: number; // sats
  cost: number; // sats
  etaInfo$: Observable<{ hashratePercentage: number, ETA: number, acceleratedETA: number }>;

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
    private servicesApiService: ServicesApiServices,
    private stateService: StateService,
    private etaService: EtaService,
    private audioService: AudioService,
    private cd: ChangeDetectorRef
  ) {
    this.accelerationUUID = window.crypto.randomUUID();
  }

  ngOnInit() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('cash_request_id')) { // Redirected from cashapp
      this.insertSquare();
      this.setupSquare();
      this.step = 'processing';
    }

    this.servicesApiService.setupSquare$().subscribe(ids => {
      this.square = {
        appId: ids.squareAppId,
        locationId: ids.squareLocationId
      };
      if (this.step === 'cta') {
        this.fetchEstimate();
      }
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

  /**
  * Scroll to element id with or without setTimeout
  */
  scrollToElementWithTimeout(id: string, position: ScrollLogicalPosition, timeout: number = 1000) {
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
          // Make min extra fee at least 50% of the current tx fee
          const minExtraBoost = nextRoundNumber(Math.max(this.estimate.cost * 2, this.estimate.txSummary.effectiveFee));
          const DEFAULT_BID_RATIO = 1.5;
          this.maxBidBoost = minExtraBoost * DEFAULT_BID_RATIO;
          this.cost = this.maxBidBoost + this.estimate.mempoolBaseFee + this.estimate.vsizeFee;
          this.etaInfo$ = this.etaService.getProjectedEtaObservable(this.estimate);
          this.calculating = false;
          this.cd.markForCheck();
        }
      }),

      catchError((response) => {
        this.error = `cannot_accelerate_tx`;
        return of(null);
      })
    ).subscribe();
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

        if (this.step === 'checkout') {
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
    this.servicesApiService.generateBTCPayAcceleratorInvoice$(this.tx.txid).subscribe({
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
  enableCheckoutPage() {
    this.step = 'paymentMethod';
  }
  selectPaymentMethod(paymentMethod: 'cashapp' | 'btcpay') {
    this.step = 'checkout';
    this.paymentMethod = paymentMethod;
    if (paymentMethod === 'cashapp') {
      this.loadingCashapp = true;
      this.insertSquare();
      this.setupSquare();
    } else if (paymentMethod === 'btcpay') {
      this.loadingBtcpayInvoice = true;
      this.requestBTCPayInvoice();
    }
  }
  selectedOptionChanged(event) {
    this.choosenOption = event.target.id;
  }
  closeModal(timeout: number = 0): void {
    setTimeout(() => {
      this.step = 'processing';
      this.cd.markForCheck();
      this.close.emit();
    }, timeout);
  }
}
