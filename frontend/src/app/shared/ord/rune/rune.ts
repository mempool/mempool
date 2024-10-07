import { u128 } from './integer';

export class Rune {

  constructor(readonly value: u128) {}

  toString() {
    let n = this.value;

    if (n === u128.MAX) {
      return 'BCGDENLQRQWDSLRUGSNLBTMFIJAV';
    }

    n = u128(n + 1n);
    let symbol = '';
    while (n > 0) {
      symbol = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Number((n - 1n) % 26n)] + symbol;
      n = u128((n - 1n) / 26n);
    }

    return symbol;
  }
}
