import { Inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';
import { Subscription } from 'rxjs';
import { StateService } from '@app/services/state.service';

@Pipe({
  name: 'fiatShortener',
  standalone: false,
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
    const currency = args[0] || this.currency || 'USD';

    if (num < 1e6) {
      return new Intl.NumberFormat(this.locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(num);
    }

    const format = new Intl.NumberFormat(this.locale, { style: 'currency', currency, maximumFractionDigits: 1 });
    const parts = format.formatToParts(num / 1e6);
    let final = '';
    let symbolAdded = false;
    for (const part of parts.reverse()) {
      if ((part.type === 'integer' || part.type === 'fraction') && !symbolAdded) {
        final = part.value + 'M' + final;
        symbolAdded = true;
      } else {
        final = part.value + final;
      }
    }
    return final;
  }
}
