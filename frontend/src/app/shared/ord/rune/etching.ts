import { None, Option, Some } from './monads';
import { Terms } from './terms';
import { Rune } from './rune';
import { u128, u32, u8 } from './integer';

type RuneEtchingBase = {
  divisibility?: number;
  premine?: bigint;
  symbol?: string;
  terms?: {
    cap?: bigint;
    amount?: bigint;
    offset?: {
      start?: bigint;
      end?: bigint;
    };
    height?: {
      start?: bigint;
      end?: bigint;
    };
  };
  turbo?: boolean;
};

export type RuneEtchingSpec = RuneEtchingBase & { runeName?: string };

export class Etching {
  readonly symbol: Option<string>;

  constructor(
    readonly divisibility: Option<u8>,
    readonly rune: Option<Rune>,
    readonly spacers: Option<u32>,
    symbol: Option<string>,
    readonly terms: Option<Terms>,
    readonly premine: Option<u128>,
    readonly turbo: boolean
  ) {
    this.symbol = symbol.andThen((value) => {
      const codePoint = value.codePointAt(0);
      return codePoint !== undefined ? Some(String.fromCodePoint(codePoint)) : None;
    });
  }

  get supply(): Option<u128> {
    const premine = this.premine.unwrapOr(u128(0));
    const cap = this.terms.andThen((terms) => terms.cap).unwrapOr(u128(0));
    const amount = this.terms.andThen((terms) => terms.amount).unwrapOr(u128(0));

    return u128
      .checkedMultiply(cap, amount)
      .andThen((multiplyResult) => u128.checkedAdd(premine, multiplyResult));
  }
}
