import { Inject, LOCALE_ID, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { Subscription } from 'rxjs';
import { StateService } from '@app/services/state.service';

// Below this threshold, show 2 decimal places even when digitsInfo requests 0,
// so small fiat amounts (e.g. $3.50) remain readable instead of rounding to $4.
export const SMALL_FIAT_THRESHOLD = 1000;

@Pipe({
  name: 'fiatCurrency',
  standalone: false,
})
export class FiatCurrencyPipe implements PipeTransform, OnDestroy {
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

  transform(num: number, ...args: any[]): unknown {
    const digitsInfo = args[0];
    const currency = args[1] || this.currency || 'USD';

    const options: Intl.NumberFormatOptions = { style: 'currency', currency };

    if (digitsInfo) {
      const match = digitsInfo.match(/^(\d+)\.(\d+)-(\d+)$/);
      if (match) {
        const minInt = parseInt(match[1], 10);
        const minFrac = parseInt(match[2], 10);
        const maxFrac = parseInt(match[3], 10);
        const currencyMaxFrac = this.getCurrencyMaxFrac(currency);
        if (minInt > 1) {
          options.minimumIntegerDigits = minInt;
        }
        if (maxFrac === 0 && Math.abs(num) < SMALL_FIAT_THRESHOLD) {
          options.minimumFractionDigits = Math.min(2, currencyMaxFrac);
          options.maximumFractionDigits = Math.min(2, currencyMaxFrac);
        } else {
          options.minimumFractionDigits = Math.min(minFrac, currencyMaxFrac);
          options.maximumFractionDigits = Math.min(maxFrac, currencyMaxFrac);
        }
      }
    }

    return new Intl.NumberFormat(this.locale, options).format(num);
  }
}
