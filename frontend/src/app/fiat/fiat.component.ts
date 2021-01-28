import { Component, OnInit, ChangeDetectionStrategy, Input, Inject, LOCALE_ID } from '@angular/core';
import { Observable } from 'rxjs';
import { StateService } from '../services/state.service';
import { getLocaleCurrencyCode, getLocaleCurrencySymbol } from '@angular/common';
import { CurrencyService } from '../services/currency.service';
import { Currency } from '../app.constants';

@Component({
  selector: 'app-fiat',
  templateUrl: './fiat.component.html',
  styleUrls: ['./fiat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiatComponent implements OnInit {
  conversions$: Observable<any>;
  currency$: Observable<Currency>;

  @Input() value: number;
  @Input() digitsInfo = '1.2-2';

  constructor(
    private stateService: StateService,
    private currencyService: CurrencyService,
    @Inject(LOCALE_ID) private localeId: string
  ) {
  }

  ngOnInit(): void {
    this.conversions$ = this.stateService.conversions$.asObservable();
    this.currency$ = this.currencyService.currency$.asObservable();
  }

}
