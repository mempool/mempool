import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'amountShortener'
})
export class AmountShortenerPipe implements PipeTransform {
  transform(num: number, ...args: any[]): unknown {
    let digits = args[0] ?? 1;
    const unit = args[1] || undefined;
    const isMoney = args[2] || false;
    const addMoreDigits = args[3] || false;

    if (num < 1000) {
      return num.toFixed(digits);
    }

    const lookup = [
      { value: 1, symbol: '' },
      { value: 1e3, symbol: 'k' },
      { value: 1e6, symbol: 'M' },
      { value: 1e9, symbol: isMoney ? 'B' : 'G' },
      { value: 1e12, symbol: 'T' },
      { value: 1e15, symbol: 'P' },
      { value: 1e18, symbol: 'E' }
    ];
    const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
    const item = lookup.slice().reverse().find((item) => num >= item.value);

    if (addMoreDigits) {
      // Add more decimal digits if the integer part is small
      const integerPartLength = Math.floor(num / item.value).toString().length;
      digits += Math.max(0, 3 - integerPartLength);
    }

    if (unit !== undefined) {
      return item ? (num / item.value).toFixed(digits).replace(rx, '$1') + ' ' + item.symbol + unit : '0';
    } else {
      return item ? (num / item.value).toFixed(digits).replace(rx, '$1') + item.symbol : '0';
    }
  }
}