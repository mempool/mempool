import { Component, OnInit, Input, ChangeDetectionStrategy } from '@angular/core';
import { StateService } from '../../services/state.service';
import { Observable } from 'rxjs';
import { Currency } from '../../app.constants';
import { CurrencyService } from '../../services/currency.service';

@Component({
  selector: 'app-amount',
  templateUrl: './amount.component.html',
  styleUrls: ['./amount.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmountComponent implements OnInit {
  conversions$: Observable<any>;
  viewFiat$: Observable<boolean>;
  currency$: Observable<Currency>;
  network = '';

  @Input() satoshis: number;
  @Input() digitsInfo = '1.8-8';
  @Input() noFiat = false;

  constructor(
    private stateService: StateService,
    private currencyService: CurrencyService,
  ) {
  }

  ngOnInit() {
    this.viewFiat$ = this.stateService.viewFiat$.asObservable();
    this.conversions$ = this.stateService.conversions$.asObservable();
    this.stateService.networkChanged$.subscribe((network) => this.network = network);
    this.currency$ = this.currencyService.currency$.asObservable();
  }

}
