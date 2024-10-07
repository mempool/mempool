import { None, Option, Some } from './monads';
import { u128 } from './integer';
import { FixedArray } from './utils';

export enum Tag {
  BODY = 0,
  FLAGS = 2,
  RUNE = 4,

  PREMINE = 6,
  CAP = 8,
  AMOUNT = 10,
  HEIGHT_START = 12,
  HEIGHT_END = 14,
  OFFSET_START = 16,
  OFFSET_END = 18,
  MINT = 20,
  POINTER = 22,
  CENOTAPH = 126,

  DIVISIBILITY = 1,
  SPACERS = 3,
  SYMBOL = 5,
  NOP = 127,
}

export namespace Tag {
  export function take<N extends number, T extends {}>(
    tag: Tag,
    fields: Map<u128, u128[]>,
    n: N,
    withFn: (values: FixedArray<u128, N>) => Option<T>
  ): Option<T> {
    const field = fields.get(u128(tag));
    if (field === undefined) {
      return None;
    }

    const values: u128[] = [];
    for (const i of [...Array(n).keys()]) {
      if (field[i] === undefined) {
        return None;
      }
      values[i] = field[i];
    }

    const optionValue = withFn(values as FixedArray<u128, N>);
    if (optionValue.isNone()) {
      return None;
    }

    field.splice(0, n);

    if (field.length === 0) {
      fields.delete(u128(tag));
    }

    return Some(optionValue.unwrap());
  }
}
