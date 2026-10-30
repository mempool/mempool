import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Subscription, of, catchError } from 'rxjs';
import { retry, tap } from 'rxjs/operators';
import { ServicesApiServices } from '@app/services/services-api.service';

@Component({
  selector: 'app-bitcoin-invoice',
  templateUrl: './bitcoin-invoice.component.html',
  styleUrls: ['./bitcoin-invoice.component.scss'],
  standalone: false,
})
export class BitcoinInvoiceComponent implements OnChanges, OnDestroy {
  @Input() invoice;
  @Input() redirect = true;
  @Input() minimal = false;
  @Output() completed = new EventEmitter();

  paymentStatusSubscription: Subscription | undefined;
  paymentStatus = 1; // 1 - Waiting for invoice | 2 - Pending payment | 3 - Payment completed
  paymentErrorMessage: string = '';

  constructor(
    private apiService: ServicesApiServices,
    private sanitizer: DomSanitizer
  ) { }

  ngOnDestroy() {
    if (this.paymentStatusSubscription) {
      this.paymentStatusSubscription.unsubscribe();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.invoice) {
      this.watchInvoice();
    }
  }

  watchInvoice(): void {
    if (this.paymentStatusSubscription) {
      this.paymentStatusSubscription.unsubscribe();
    }
    if (!this.invoice) {
      this.paymentStatus = 1;
      return;
    }
    if (this.invoice.btcDue > 0) {
      this.paymentStatus = 2;
    } else {
      this.paymentStatus = 4;
    }

    this.monitorPendingInvoice();
  }

  monitorPendingInvoice(): void {
    if (!this.invoice) {
      return;
    }
    if (this.paymentStatusSubscription) {
      this.paymentStatusSubscription.unsubscribe();
    }
    this.paymentStatusSubscription = this.apiService.getPaymentStatus$(this.invoice.btcpayInvoiceId).pipe(
      tap(result => {
        if (result.status === 204) { // Manually trigger an error in that case so we can retry
          throw result;
        } else if (result.status === 200) { // Invoice settled
          this.paymentStatus = 3;
          this.completed.emit();
        }
      }),
      catchError(err => {
        if (err.status === 204 || err.status === 504) {
          throw err; // Will trigger the retry
        } else if (err.status === 400) {
          this.paymentErrorMessage = 'Invoice has expired';
        } else if (err.status === 404) {
          this.paymentErrorMessage = 'Invoice is no longer valid';
        }
        this.paymentStatus = -1;
        return of(null);
      }),
      retry({ delay: 1000 }),
    ).subscribe();
  }

  bypassSecurityTrustUrl(text: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(text);
  }

  /**
   * Builds a BIP21 payment URI string for QR code display.
   *
   * - If a BTC address is present, produces `bitcoin:<address>?amount=<btcDue>`
   *   with an optional `&label=<itemDesc>` parameter when a description is set.
   * - If a Lightning address is also present, appends `&lightning=<invoice>` to the
   *   bitcoin URI, or falls back to a standalone `lightning:<invoice>` URI when no
   *   on-chain address is available.
   * - Returns an empty string when neither address type is present.
   */
  get qrCodeString(): string {
    if (!this.invoice?.addresses || (!this.invoice.addresses.BTC && !this.invoice.addresses.BTC_LightningLike)) {
      return '';
    }

    let str = '';
    if (this.invoice.addresses.BTC) {
      str = `bitcoin:${this.invoice.addresses.BTC}?amount=${this.invoice.btcDue}`;
      if (this.invoice.itemDesc) {
        str += `&label=${encodeURIComponent(this.invoice.itemDesc)}`;
      }
    }
    if (this.invoice.addresses.BTC_LightningLike) {
      str += `${str.length ? '&lightning=' : 'lightning:'}${this.invoice.addresses.BTC_LightningLike}`;
    }

    return str;
  }
}
