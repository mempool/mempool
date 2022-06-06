import { formatCurrency, getCurrencySymbol } from '@angular/common';
import { Inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'fiatShortener'
})
export class FiatShortenerPipe implements PipeTransform {
  constructor(
    @Inject(LOCALE_ID) public locale: string
  ) {}

  transform(num: number, ...args: any[]): unknown {
    const digits = args[0] || 1;
    const unit = args[1] || undefined;

    if (num < 1000) {
      return num.toFixed(digits);
    }

    const lookup = [
      { value: 1, symbol: '' },
      { value: 1e3, symbol: 'k' },
      { value: 1e6, symbol: 'M' },
      { value: 1e9, symbol: 'G' },
      { value: 1e12, symbol: 'T' },
      { value: 1e15, symbol: 'P' },
      { value: 1e18, symbol: 'E' }
    ];
    const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
    const item = lookup.slice().reverse().find((item) => num >= item.value);

    let result = item ? (num / item.value).toFixed(digits).replace(rx, '$1') : '0';
    result = formatCurrency(parseInt(result, 10), this.locale, getCurrencySymbol('USD', 'narrow'), 'USD', '1.0-0');

    return result + item.symbol;
  }
}