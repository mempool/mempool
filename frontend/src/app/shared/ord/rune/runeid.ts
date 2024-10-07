import { None, Option, Some } from './monads';
import { u64, u32, u128 } from './integer';

export class RuneId {
  constructor(readonly block: u64, readonly tx: u32) {}

  static new(block: u64, tx: u32): Option<RuneId> {
    const id = new RuneId(block, tx);

    if (id.block === 0n && id.tx > 0) {
      return None;
    }

    return Some(id);
  }

  static sort(runeIds: RuneId[]): RuneId[] {
    return [...runeIds].sort((x, y) => Number(x.block - y.block || x.tx - y.tx));
  }

  delta(next: RuneId): Option<[u128, u128]> {
    const optionBlock = u64.checkedSub(next.block, this.block);
    if (optionBlock.isNone()) {
      return None;
    }
    const block = optionBlock.unwrap();

    let tx: u32;
    if (block === 0n) {
      const optionTx = u32.checkedSub(next.tx, this.tx);
      if (optionTx.isNone()) {
        return None;
      }
      tx = optionTx.unwrap();
    } else {
      tx = next.tx;
    }

    return Some([u128(block), u128(tx)]);
  }

  next(block: u128, tx: u128): Option<RuneId> {
    const optionBlock = u128.tryIntoU64(block);
    const optionTx = u128.tryIntoU32(tx);

    if (optionBlock.isNone() || optionTx.isNone()) {
      return None;
    }

    const blockU64 = optionBlock.unwrap();
    const txU32 = optionTx.unwrap();

    const nextBlock = u64.checkedAdd(this.block, blockU64);
    if (nextBlock.isNone()) {
      return None;
    }

    let nextTx: u32;
    if (blockU64 === 0n) {
      const optionAdd = u32.checkedAdd(this.tx, txU32);
      if (optionAdd.isNone()) {
        return None;
      }

      nextTx = optionAdd.unwrap();
    } else {
      nextTx = txU32;
    }

    return RuneId.new(nextBlock.unwrap(), nextTx);
  }

  toString() {
    return `${this.block}:${this.tx}`;
  }

  static fromString(s: string) {
    const parts = s.split(':');
    if (parts.length !== 2) {
      throw new Error(`invalid rune ID: ${s}`);
    }

    const [block, tx] = parts;
    if (!/^\d+$/.test(block) || !/^\d+$/.test(tx)) {
      throw new Error(`invalid rune ID: ${s}`);
    }
    return new RuneId(u64(BigInt(block)), u32(BigInt(tx)));
  }
}
