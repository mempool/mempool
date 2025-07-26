import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'amountShortener'
})
export class AmountShortenerPipe implements PipeTransform {
  transform(num: number, ...args: any[]): unknown {
    const digits = args[0] ?? 1;
    const unit = args[1] || undefined;
    const isMoney = args[2] || false;
    const sigfigs = args[3] || false; // if true, "digits" is the number of significant digits, not the number of decimal places

    if (num < 1000) {
      let formattedNum: string;
      if (sigfigs) {
        formattedNum = Number(num.toPrecision(digits)).toString();
      } else {
        formattedNum = num.toFixed(digits);
      }

      return unit !== undefined
        ? formattedNum + ' ' + unit
        : formattedNum;
    }

    const lookup = [
      { value: 1, symbol: '' },
      { value: 1e3, symbol: 'k' },
      { value: 1e6, symbol: 'M' },
      { value: 1e9, symbol: isMoney ? 'B' : 'G' },
      { value: 1e12, symbol: 'T' },
      { value: 1e15, symbol: 'P' },
      { value: 1e18, symbol: 'E' },
      { value: 1e21, symbol: 'Z' },
      { value: 1e24, symbol: 'Y' }
    ];
    const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
    const item = lookup.slice().reverse().find((item) => num >= item.value);

    if (!item) {
      return '0';
    }

    const scaledNum = num / item.value;
    const formattedNum = Number(sigfigs ? scaledNum.toPrecision(digits) : scaledNum.toFixed(digits)).toString();

    return unit !== undefined
      ? formattedNum + ' ' + item.symbol + unit
      : formattedNum + item.symbol;
  }
}