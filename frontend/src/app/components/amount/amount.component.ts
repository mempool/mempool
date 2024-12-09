import { Component, OnInit, OnDestroy, Input, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { StateService } from '@app/services/state.service';
import { Observable, Subscription } from 'rxjs';
import { Price } from '@app/services/price.service';

@Component({
  selector: 'app-amount',
  templateUrl: './amount.component.html',
  styleUrls: ['./amount.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmountComponent implements OnInit, OnDestroy {
  conversions$: Observable<any>;
  currency: string;
  viewAmountMode$: Observable<'btc' | 'sats' | 'fiat'>;
  network = '';

  stateSubscription: Subscription;
  currencySubscription: Subscription;

  @Input() satoshis: number;
  @Input() digitsInfo = '1.8-8';
  @Input() noFiat = false;
  @Input() addPlus = false;
  @Input() blockConversion: Price;
  @Input() forceBtc: boolean = false;
  @Input() ignoreViewMode: boolean = false;
  @Input() forceBlockConversion: boolean = false; // true = displays fiat price as 0 if blockConversion is undefined instead of falling back to conversions

  constructor(
    private stateService: StateService,
    private cd: ChangeDetectorRef,
  ) {
    this.currencySubscription = this.stateService.fiatCurrency$.subscribe((fiat) => {
      this.currency = fiat;
      this.cd.markForCheck();
    });
  }

  ngOnInit() {
    this.viewAmountMode$ = this.stateService.viewAmountMode$.asObservable();
    this.conversions$ = this.stateService.conversions$.asObservable();
    this.stateSubscription = this.stateService.networkChanged$.subscribe((network) => this.network = network);
  }

  ngOnDestroy() {
    if (this.stateSubscription) {
      this.stateSubscription.unsubscribe();
    }
    this.currencySubscription.unsubscribe();
  }

}
