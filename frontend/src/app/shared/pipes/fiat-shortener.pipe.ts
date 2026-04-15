import { Inject, LOCALE_ID, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { Subscription } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { SMALL_FIAT_THRESHOLD } from './fiat-currency.pipe';

@Pipe({
  name: 'fiatShortener',
  standalone: false,
})
export class FiatShortenerPipe implements PipeTransform, OnDestroy {
  fiatSubscription: Subscription;
  currency: string;
  private currencyMaxFracCache: Record<string, number> = {};

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private stateService: StateService,
  ) {
    this.fiatSubscription = this.stateService.fiatCurrency$.subscribe((fiat) => {
      this.currency = fiat;
    });
  }

  ngOnDestroy(): void {
    this.fiatSubscription.unsubscribe();
  }

  private getCurrencyMaxFrac(currency: string): number {
    if (!(currency in this.currencyMaxFracCache)) {
      this.currencyMaxFracCache[currency] =
        new Intl.NumberFormat(this.locale, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ??
        Number.POSITIVE_INFINITY;
    }
    return this.currencyMaxFracCache[currency];
  }

  transform(num: number, currencyInput?: string): unknown {
    const currency = currencyInput || this.currency || 'USD';

    if (Math.abs(num) < SMALL_FIAT_THRESHOLD) {
      const maxFrac = Math.min(2, this.getCurrencyMaxFrac(currency));
      return new Intl.NumberFormat(this.locale, { style: 'currency', currency, minimumFractionDigits: maxFrac, maximumFractionDigits: maxFrac }).format(num);
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
    const absNum = Math.abs(num);
    const item = lookup.slice().reverse().find((item) => absNum >= item.value);

    if (!item) {
      return new Intl.NumberFormat(this.locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(0);
    }

    const result = new Intl.NumberFormat(this.locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(num / item.value);

    return result + item.symbol;
  }
}
