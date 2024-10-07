import { None, Option, Some } from '../monads';
import { SeekArray } from '../seekarray';
import { u64 } from './u64';
import { u32 } from './u32';
import { u8 } from './u8';

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

/**
 * ## 128-bit unsigned integer
 *
 * - **Value Range:** `0` to `340282366920938463463374607431768211455`
 * - **Size in bytes:** `16`
 * - **Web IDL type:** `bigint`
 * - **Equivalent C type:** `uint128_t`
 */
export type u128 = BigTypedNumber<'u128'>;

export const U128_MAX_BIGINT = 0xffff_ffff_ffff_ffff_ffff_ffff_ffff_ffffn;

/**
 * Convert Number or BigInt to 128-bit unsigned integer.
 * @param num - The Number or BigInt to convert.
 * @returns - The resulting 128-bit unsigned integer (BigInt).
 */
export function u128(num: number | bigint): u128 {
  if (typeof num == 'bigint') {
    if (num < 0n || num > U128_MAX_BIGINT) {
      throw new Error('num is out of range');
    }
  } else {
    if (!Number.isSafeInteger(num) || num < 0) {
      throw new Error('num is not a valid integer');
    }
  }

  return BigInt(num) as u128;
}

export namespace u128 {
  export const MAX = u128(U128_MAX_BIGINT);

  export function checkedAdd(x: u128, y: u128): Option<u128> {
    const result = x + y;
    if (result > u128.MAX) {
      return None;
    }

    return Some(u128(result));
  }

  export function checkedAddThrow(x: u128, y: u128): u128 {
    const option = u128.checkedAdd(x, y);
    if (option.isNone()) {
      throw new Error('checked add overflow');
    }
    return option.unwrap();
  }

  export function checkedSub(x: u128, y: u128): Option<u128> {
    const result = x - y;
    if (result < 0n) {
      return None;
    }

    return Some(u128(result));
  }

  export function checkedSubThrow(x: u128, y: u128): u128 {
    const option = u128.checkedSub(x, y);
    if (option.isNone()) {
      throw new Error('checked sub overflow');
    }
    return option.unwrap();
  }

  export function checkedMultiply(x: u128, y: u128): Option<u128> {
    const result = x * y;
    if (result > u128.MAX) {
      return None;
    }

    return Some(u128(result));
  }

  export function saturatingAdd(x: u128, y: u128): u128 {
    const result = x + y;
    return result > u128.MAX ? u128.MAX : u128(result);
  }

  export function saturatingMultiply(x: u128, y: u128): u128 {
    const result = x * y;
    return result > u128.MAX ? u128.MAX : u128(result);
  }

  export function saturatingSub(x: u128, y: u128): u128 {
    return u128(x < y ? 0 : x - y);
  }

  export function decodeVarInt(seekArray: SeekArray): Option<u128> {
    try {
      return Some(tryDecodeVarInt(seekArray));
    } catch (e) {
      return None;
    }
  }

  export function tryDecodeVarInt(seekArray: SeekArray): u128 {
    let result: u128 = u128(0);
    for (let i = 0; i <= 18; i++) {
      const byte = seekArray.readUInt8();
      if (byte === undefined) throw new Error('Unterminated or invalid data');

      // Ensure all operations are done in bigint domain.
      const byteBigint = BigInt(byte);
      const value = u128(byteBigint & 0x7Fn);  // Ensure the 'value' is treated as u128.

      if (i === 18 && (value & 0x7Cn) !== 0n) throw new Error('Overflow');

      // Use bigint addition instead of bitwise OR to combine the results,
      // and ensure shifting is handled correctly within the bigint domain.
      result = u128(result + (value << (7n * BigInt(i))));

      if ((byte & 0x80) === 0) return result;
    }
    throw new Error('Overlong encoding');
  }

  export function encodeVarInt(value: u128): Uint8Array {
    const bytes = [];
    while (value >> 7n > 0n) {
      bytes.push(Number(value & 0x7Fn) | 0x80);
      value = u128(value >> 7n);  // Explicitly cast the shifted value back to u128
    }
    bytes.push(Number(value & 0x7Fn));
    return new Uint8Array(bytes);
  }

  export function tryIntoU64(n: u128): Option<u64> {
    return n > u64.MAX ? None : Some(u64(n));
  }

  export function tryIntoU32(n: u128): Option<u32> {
    return n > u32.MAX ? None : Some(u32(n));
  }

  export function tryIntoU8(n: u128): Option<u8> {
    return n > u8.MAX ? None : Some(u8(n));
  }
}

export function* getAllU128(data: Uint8Array): Generator<u128> {
  const seekArray = new SeekArray(data);
  while (!seekArray.isFinished()) {
    const nextValue = u128.decodeVarInt(seekArray);
    if (nextValue.isNone()) {
      return;
    }
    yield nextValue.unwrap();
  }
}
