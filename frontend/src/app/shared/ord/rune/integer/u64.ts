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

export type u64 = BigTypedNumber<'u64'>;

export const U64_MAX_BIGINT = 0xffff_ffff_ffff_ffffn;

export function u64(num: number | bigint): u64 {
  if (typeof num == 'bigint') {
    if (num < 0n || num > U64_MAX_BIGINT) {
      throw new Error('num is out of range');
    }
  } else {
    if (!Number.isSafeInteger(num) || num < 0) {
      throw new Error('num is not a valid integer');
    }
  }

  return BigInt(num) as u64;
}

export namespace u64 {
  export const MAX = u64(U64_MAX_BIGINT);

  export function checkedAdd(x: u64, y: u64): Option<u64> {
    const result = x + y;
    if (result > u64.MAX) {
      return None;
    }

    return Some(u64(result));
  }

  export function checkedSub(x: u64, y: u64): Option<u64> {
    const result = x - y;
    if (result < 0n) {
      return None;
    }

    return Some(u64(result));
  }
}
