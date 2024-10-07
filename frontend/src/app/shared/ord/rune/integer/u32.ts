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

export type u32 = BigTypedNumber<'u32'>;

export const U32_MAX_BIGINT = 0xffff_ffffn;

export function u32(num: number | bigint): u32 {
  if (typeof num == 'bigint') {
    if (num < 0n || num > U32_MAX_BIGINT) {
      throw new Error('num is out of range');
    }
  } else {
    if (!Number.isSafeInteger(num) || num < 0) {
      throw new Error('num is not a valid integer');
    }
  }

  return BigInt(num) as u32;
}

export namespace u32 {
  export const MAX = u32(U32_MAX_BIGINT);

  export function checkedAdd(x: u32, y: u32): Option<u32> {
    const result = x + y;
    if (result > u32.MAX) {
      return None;
    }

    return Some(u32(result));
  }

  export function checkedSub(x: u32, y: u32): Option<u32> {
    const result = x - y;
    if (result < 0n) {
      return None;
    }

    return Some(u32(result));
  }
}
