import { Rune } from './rune';

export class SpacedRune {
  constructor(readonly rune: Rune, readonly spacers: number) {}

  toString(): string {
    const rune = this.rune.toString();
    let i = 0;
    let result = '';
    for (const c of rune) {
      result += c;

      if (i < rune.length - 1 && (this.spacers & (1 << i)) !== 0) {
        result += '•';
      }
      i++;
    }

    return result;
  }
}
