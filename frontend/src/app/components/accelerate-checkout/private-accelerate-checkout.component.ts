import { Component, ChangeDetectionStrategy, ChangeDetectorRef, Input, OnDestroy, OnInit } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { ServicesApiServices } from '@app/services/services-api.service';
import { StateService } from '@app/services/state.service';
import { WebsocketService } from '@app/services/websocket.service';
import { EtaService } from '@app/services/eta.service';
import { MiningService, MiningStats } from '@app/services/mining.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { PrivateAccelerationEstimate, PrivateAccelerationInvoice } from '@interfaces/private-acceleration.interface';

type CheckoutStep = 'intro' | 'quote' | 'invoice' | 'processing' | 'success' | 'error';

const ERROR_MESSAGES: Record<string, string> = {
  cannot_decode_raw_tx: $localize`:@@private-accel.error.decode:This transaction could not be decoded.`,
  private_tx_must_be_zero_fee: $localize`:@@private-accel.error.fee:This transaction pays a fee. A privately accelerated transaction must pay exactly zero fee.`,
  private_tx_unconfirmed_inputs: $localize`:@@private-accel.error.input-unavailable:This transaction spends an output that is not confirmed, or that has already been spent. Only confirmed unspent outputs can be used.`,
  private_tx_not_standard: $localize`:@@private-accel.error.nonstandard:This transaction was rejected by standard Bitcoin Core policy.`,
  private_tx_too_large: $localize`:@@private-accel.error.too-large:This transaction is too large to accelerate privately.`,
  private_tx_already_public: $localize`:@@private-accel.error.public:This transaction is already public. Use normal acceleration instead.`,
  private_tx_conflicts_with_pending: $localize`:@@private-accel.error.conflict:This transaction conflicts with a private acceleration already in flight.`,
  acceleration_duplicated: $localize`:@@private-accel.error.duplicate:This transaction is already being accelerated.`,
  not_enough_balance: $localize`:@@private-accel.error.balance:Your account balance is not high enough.`,
  no_private_capable_pool: $localize`:@@private-accel.error.no-pool:No mining pool is currently available for private acceleration.`,
  not_available: $localize`:@@private-accel.error.unavailable:Private acceleration is not available right now.`,
};

const DEFAULT_ERROR = $localize`:@@private-accel.error.generic:Something went wrong.`;

@Component({
  selector: 'app-private-accelerate-checkout',
  templateUrl: './private-accelerate-checkout.component.html',
  styleUrls: ['./private-accelerate-checkout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PrivateAccelerateCheckout implements OnInit, OnDestroy {
  @Input() txHex: string;

  step: CheckoutStep = 'intro';
  isLoading = false;
  isSubmitting = false;
  estimate: PrivateAccelerationEstimate;
  userBid = 0;
  invoice: PrivateAccelerationInvoice;
  error: string;
  etaInfo$: Observable<{ hashratePercentage?: number, acceleratedETA?: number }>;
  miningStats: MiningStats;
  slowAcceptance = false;

  private estimateSubscription: Subscription;
  private submitSubscription: Subscription;
  private acceptedSubscription: Subscription;
  private miningStatsSubscription: Subscription;
  private slowAcceptanceTimeout: number;

  constructor(
    private servicesApiService: ServicesApiServices,
    private stateService: StateService,
    private websocketService: WebsocketService,
    private etaService: EtaService,
    private miningService: MiningService,
    private relativeUrlPipe: RelativeUrlPipe,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {}

  /** The raw transaction is not sent to our servers until this is called. */
  startCheckout(): void {
    this.isLoading = true;
    this.step = 'quote';
    this.cd.markForCheck();

    this.estimateSubscription = this.servicesApiService.estimatePrivate$(this.txHex).subscribe({
      next: (response) => {
        this.estimate = response.body;
        this.isLoading = false;
        if (!this.estimate || this.estimate.unavailable || !this.estimate.pools?.length) {
          this.fail('no_private_capable_pool');
          return;
        }
        this.userBid = Math.max(0, ...(this.estimate.options || []).map(option => option.fee));
        this.etaInfo$ = this.etaService.getPrivateEtaObservable(this.estimate);
        this.miningStatsSubscription = this.miningService.getMiningStats('1m').subscribe((stats) => {
          this.miningStats = stats;
          this.cd.markForCheck();
        });
        this.cd.markForCheck();
      },
      error: (response) => {
        this.isLoading = false;
        this.fail(response.error);
      },
    });
  }

  ngOnDestroy(): void {
    this.estimateSubscription?.unsubscribe();
    this.submitSubscription?.unsubscribe();
    this.acceptedSubscription?.unsubscribe();
    this.miningStatsSubscription?.unsubscribe();
    window.clearTimeout(this.slowAcceptanceTimeout);
    this.websocketService.stopTrackingTransaction();
  }

  get cost(): number {
    return (this.estimate?.mempoolBaseFee || 0) + (this.estimate?.vsizeFee || 0) + this.userBid;
  }

  get canPayWithLightning(): boolean {
    return this.estimate?.availablePaymentMethods?.bitcoin != null;
  }

  get canPayFromBalance(): boolean {
    return this.estimate?.availablePaymentMethods?.balance != null && this.estimate.userBalance >= this.cost;
  }

  get transactionLink(): string[] {
    return [this.relativeUrlPipe.transform('/tx'), this.estimate.handle];
  }

  payFromBalance(): void {
    this.isSubmitting = true;
    this.cd.markForCheck();
    this.submitSubscription = this.servicesApiService.acceleratePrivate$(this.txHex, this.userBid).subscribe({
      next: () => this.waitForAcceptance(),
      error: (response) => {
        this.isSubmitting = false;
        this.fail(response.error);
      },
    });
  }

  payWithLightning(): void {
    this.isSubmitting = true;
    this.cd.markForCheck();
    this.submitSubscription = this.servicesApiService.acceleratePrivateWithLightning$(this.txHex, this.userBid).subscribe({
      next: (invoice) => {
        this.invoice = invoice;
        this.isSubmitting = false;
        this.step = 'invoice';
        this.cd.markForCheck();
      },
      error: (response) => {
        this.isSubmitting = false;
        this.fail(response.error);
      },
    });
  }

  /** A private acceleration is identified by its handle until it confirms. */
  waitForAcceptance(): void {
    this.isSubmitting = false;
    this.step = 'processing';
    this.cd.markForCheck();

    this.slowAcceptanceTimeout = window.setTimeout(() => {
      this.slowAcceptance = true;
      this.cd.markForCheck();
    }, 30000);

    const handle = this.estimate.handle;
    this.websocketService.startTrackTransaction(handle);
    this.acceptedSubscription = this.stateService.mempoolTxPosition$.pipe(
      filter(position => position?.txid === handle),
      take(1),
    ).subscribe(() => {
      this.step = 'success';
      this.cd.markForCheck();
    });
  }

  private fail(code: string): void {
    this.error = ERROR_MESSAGES[code] || DEFAULT_ERROR;
    this.step = 'error';
    this.cd.markForCheck();
  }
}
