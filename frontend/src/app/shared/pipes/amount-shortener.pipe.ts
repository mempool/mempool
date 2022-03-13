import { Pipe, PipeTransform } from '@angular/core';

// https://medium.com/@thunderroid/angular-short-number-suffix-pipe-1k-2m-3b-dded4af82fb4

@Pipe({
  name: 'amountShortener'
})
export class AmountShortenerPipe implements PipeTransform {
  transform(number: number, args?: any): any {
    if (isNaN(number)) return null; // will only work value is a number
    if (number === null) return null;
    if (number === 0) return null;
    let abs = Math.abs(number);
    const rounder = Math.pow(10, 1);
    const isNegative = number < 0; // will also work for Negetive numbers
    let key = '';

    const powers = [
      { key: 'E', value: 10e18 },
      { key: 'P', value: 10e15 },
      { key: 'T', value: 10e12 },
      { key: 'B', value: 10e9 },
      { key: 'M', value: 10e6 },
      { key: 'K', value: 1000 }
    ];

    for (let i = 0; i < powers.length; i++) {
      let reduced = abs / powers[i].value;
      reduced = Math.round(reduced * rounder) / rounder;
      if (reduced >= 1) {
        abs = reduced;
        key = powers[i].key;
        break;
      }
    }

    return (isNegative ? '-' : '') + abs + key;
  }
}