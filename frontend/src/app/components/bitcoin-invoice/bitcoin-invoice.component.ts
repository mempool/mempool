import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Subscription, of, timer } from 'rxjs';
import { retry, switchMap, tap } from 'rxjs/operators';
import { ServicesApiServices } from '../../services/services-api.service';

@Component({
  selector: 'app-bitcoin-invoice',
  templateUrl: './bitcoin-invoice.component.html',
  styleUrls: ['./bitcoin-invoice.component.scss']
})
export class BitcoinInvoiceComponent implements OnInit, OnChanges, OnDestroy {
  @Input() invoice;
  @Input() invoiceId: string;
  @Input() redirect = true;
  @Input() minimal = false;
  @Output() completed = new EventEmitter();

  paymentForm: FormGroup;
  requestSubscription: Subscription | undefined;
  paymentStatusSubscription: Subscription | undefined;
  loadedInvoice: any;
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

    /**
     * If the invoice is passed in the url, fetch it and display btcpay payment
     * Otherwise get a new invoice
     */
    this.paramMapSubscription = this.activatedRoute.paramMap
      .pipe(
        tap((paramMap) => {
          this.fetchInvoice(paramMap.get('invoiceId') ?? this.invoiceId);
        })
      ).subscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes.invoice || changes.invoiceId) && this.invoiceId) {
      this.fetchInvoice(this.invoiceId);
    }
  }

  fetchInvoice(invoiceId: string): void {
    if (invoiceId) {
      if (this.paymentStatusSubscription) {
        this.paymentStatusSubscription.unsubscribe();
      }
      this.paymentStatusSubscription = ((this.invoice && this.invoice.id === invoiceId) ? of(this.invoice) : this.apiService.retreiveInvoice$(invoiceId)).pipe(
        tap((invoice: any) => {
          this.loadedInvoice = invoice;
          if (this.loadedInvoice.btcDue > 0) {
            this.paymentStatus = 2;
          } else {
            this.paymentStatus = 4;
          }
        }),
        switchMap(() => this.apiService.getPaymentStatus$(this.loadedInvoice.id)
          .pipe(
            retry({ delay: () => timer(2000)})
          )
        ),
      ).subscribe({
        next: ((result) => {
          this.paymentStatus = 3;
          this.completed.emit();
        }),
      });
    }
  }

  get availableMethods(): string[] {
    return Object.keys(this.loadedInvoice?.addresses || {}).filter(k => k === 'BTC_LightningLike');
  }

  bypassSecurityTrustUrl(text: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(text);
  }
}
