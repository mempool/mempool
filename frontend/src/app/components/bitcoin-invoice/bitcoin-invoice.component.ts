import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Subscription, of, timer } from 'rxjs';
import { filter, repeat, retry, switchMap, take, tap } from 'rxjs/operators';
import { ServicesApiServices } from '@app/services/services-api.service';

@Component({
  selector: 'app-bitcoin-invoice',
  templateUrl: './bitcoin-invoice.component.html',
  styleUrls: ['./bitcoin-invoice.component.scss']
})
export class BitcoinInvoiceComponent implements OnInit, OnChanges, OnDestroy {
  @Input() invoice;
  @Input() redirect = true;
  @Input() minimal = false;
  @Output() completed = new EventEmitter();

  paymentForm: FormGroup;
  requestSubscription: Subscription | undefined;
  paymentStatusSubscription: Subscription | undefined;
  paymentStatus = 1; // 1 - Waiting for invoice | 2 - Pending payment | 3 - Payment completed
  paramMapSubscription: Subscription | undefined;
  invoiceSubscription: Subscription | undefined;
  invoiceTimeout; // Wait for angular to load all the things before making a request

  constructor(
    private formBuilder: FormBuilder,
    private apiService: ServicesApiServices,
    private sanitizer: DomSanitizer,
    private activatedRoute: ActivatedRoute
  ) { }

  ngOnDestroy() {
    if (this.requestSubscription) {
      this.requestSubscription.unsubscribe();
    }
    if (this.paramMapSubscription) {
      this.paramMapSubscription.unsubscribe();
    }
    if (this.invoiceSubscription) {
      this.invoiceSubscription.unsubscribe();
    }
    if (this.paymentStatusSubscription) {
      this.paymentStatusSubscription.unsubscribe();
    }
  }

  ngOnInit(): void {
    this.paymentForm = this.formBuilder.group({
      'method': 'lightning'
    });
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
    this.paymentStatusSubscription = this.apiService.getPaymentStatus$(this.invoice.btcpayInvoiceId).pipe(
      retry({ delay: () => timer(2000)}),
      repeat({delay: 2000}),
      filter((response) => response.status !== 204 && response.status !== 404),
      take(1),
    ).subscribe(() => {
      this.paymentStatus = 3;
      this.completed.emit();
    });
  }

  get availableMethods(): string[] {
    return Object.keys(this.invoice?.addresses || {}).filter(k => k === 'BTC_LightningLike');
  }

  bypassSecurityTrustUrl(text: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(text);
  }
}
