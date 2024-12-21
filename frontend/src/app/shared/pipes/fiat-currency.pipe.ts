import { formatCurrency, getCurrencySymbol } from '@angular/common';
import { Inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';
import { Subscription } from 'rxjs';
import { StateService } from '@app/services/state.service';

@Pipe({
  name: 'fiatCurrency'
})
export class FiatCurrencyPipe implements PipeTransform {
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
    const digits = args[0] || 1;
    const currency = args[1] || this.currency || 'USD';

    if (Math.abs(num) >= 1000) {
      return new Intl.NumberFormat(this.locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(num);
    } else {
      return new Intl.NumberFormat(this.locale, { style: 'currency', currency }).format(num);
    }
  }
}
