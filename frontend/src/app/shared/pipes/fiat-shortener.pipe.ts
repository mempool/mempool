import { Inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';
import { Subscription } from 'rxjs';
import { StateService } from '../../services/state.service';

@Pipe({
  name: 'fiatShortener'
})
export class FiatShortenerPipe implements PipeTransform {
  fiatSubscription: Subscription;
  currency: string;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private stateService: StateService,
  ) {
    this.fiatSubscription = this.stateService.fiatCurrency$.subscribe((fiat) => {
      this.currency = fiat;
    });
  }

  transform(num: number, ...args: any[]): unknown {
    const currency = args[1] || this.currency || 'USD';

    if (num < 100000) {
      return new Intl.NumberFormat(this.locale, { style: 'currency', currency }).format(num);
    }

    const lookup = [
      { value: 1, symbol: '' },
      { value: 1e3, symbol: 'k' },
      { value: 1e6, symbol: 'M' },
      { value: 1e9, symbol: 'B' },
      { value: 1e12, symbol: 'T' },
      { value: 1e15, symbol: 'P' },
      { value: 1e18, symbol: 'E' }
    ];
    const item = lookup.slice().reverse().find((item) => num >= item.value);

    const format = new Intl.NumberFormat(this.locale, { style: 'currency', currency, maximumSignificantDigits: 3 });
    const parts = format.formatToParts(item ? num / item.value : 0);

    let final = '';
    let powerTenSymbolAdded = false;
    for (const part of parts.reverse()) {
      if ((part.type === 'integer' || part.type === 'fraction') && powerTenSymbolAdded === false) {
        final = part.value + item.symbol + final;
        powerTenSymbolAdded = true;
      } else {
        final = part.value + final;
      }
    }
    
    return final;
  }
}