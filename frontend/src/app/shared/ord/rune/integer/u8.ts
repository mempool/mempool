import { None, Option, Some } from '../monads';

/**
 * A little utility type used for nominal typing.
 *
 * See {@link https://michalzalecki.com/nominal-typing-in-typescript/}
 */
type BigTypedNumber<T> = bigint & {
  /**
   * # !!! DO NOT USE THIS PROPERTY IN YOUR CODE !!!
   * ## This is just used to make each `BigTypedNumber` alias unique for Typescript and doesn't actually exist.
   * @ignore
   * @private
   * @readonly
   * @type {undefined}
   */
  readonly __kind__: T;
};

export type u8 = BigTypedNumber<'u8'>;

export const U8_MAX_BIGINT = 0xffn;

export function u8(num: number | bigint): u8 {
  if (typeof num == 'bigint') {
    if (num < 0n || num > U8_MAX_BIGINT) {
      throw new Error('num is out of range');
    }
  } else {
    if (!Number.isSafeInteger(num) || num < 0) {
      throw new Error('num is not a valid integer');
    }
  }

  return BigInt(num) as u8;
}

export namespace u8 {
  export const MAX = u8(U8_MAX_BIGINT);

  export function checkedAdd(x: u8, y: u8): Option<u8> {
    const result = x + y;
    if (result > u8.MAX) {
      return None;
    }

    return Some(u8(result));
  }

  export function checkedSub(x: u8, y: u8): Option<u8> {
    const result = x - y;
    if (result < 0n) {
      return None;
    }

    return Some(u8(result));
  }
}
