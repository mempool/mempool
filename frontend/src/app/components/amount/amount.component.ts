import { Component, OnInit, OnDestroy, Input, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { StateService } from '../../services/state.service';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-amount',
  templateUrl: './amount.component.html',
  styleUrls: ['./amount.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmountComponent implements OnInit, OnDestroy {
  conversions$: Observable<any>;
  currency: string;
  viewFiat$: Observable<boolean>;
  network = '';

  stateSubscription: Subscription;
  currencySubscription: Subscription;

  @Input() satoshis: number;
  @Input() digitsInfo = '1.8-8';
  @Input() noFiat = false;
  @Input() addPlus = false;

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
    this.viewFiat$ = this.stateService.viewFiat$.asObservable();
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
