import { u128 } from './integer';

export enum Flag {
  ETCHING = 0,
  TERMS = 1,
  TURBO = 2,
  CENOTAPH = 127,
}

export namespace Flag {
  export function mask(flag: Flag): u128 {
    return u128(1n << BigInt(flag));
  }

  export function take(flags: u128, flag: Flag): { set: boolean; flags: u128 } {
    const mask = Flag.mask(flag);
    const set = (flags & mask) !== 0n;
    return { set, flags: set ? u128(flags - mask) : flags };
  }
}
