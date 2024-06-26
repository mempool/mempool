import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Subscription, timer } from 'rxjs';
import { retry, switchMap, tap } from 'rxjs/operators';
import { ServicesApiServices } from '../../services/services-api.service';

@Component({
  selector: 'app-bitcoin-invoice',
  templateUrl: './bitcoin-invoice.component.html',
  styleUrls: ['./bitcoin-invoice.component.scss']
})
export class BitcoinInvoiceComponent implements OnInit, OnDestroy {
  @Input() invoiceId: string;
  @Input() redirect = true;
  @Output() completed = new EventEmitter();

  paymentForm: FormGroup;
  requestSubscription: Subscription | undefined;
  paymentStatusSubscription: Subscription | undefined;
  invoice: any;
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
          const invoiceId = paramMap.get('invoiceId') ?? this.invoiceId;
          if (invoiceId) {
            this.paymentStatusSubscription = this.apiService.retreiveInvoice$(invoiceId).pipe(
              tap((invoice: any) => {
                this.invoice = invoice;
                this.invoice.amount = invoice.btcDue ?? (invoice.cryptoInfo.length ? parseFloat(invoice.cryptoInfo[0].totalDue) : 0) ?? 0;

                if (this.invoice.amount > 0) {
                  this.paymentStatus = 2;
                } else {
                  this.paymentStatus = 4;
                }
              }),
              switchMap(() => this.apiService.getPaymentStatus$(this.invoice.id)
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
        })
      ).subscribe();
  }

  bypassSecurityTrustUrl(text: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(text);
  }
}
