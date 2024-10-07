import { Option, Some, None } from './monads';
import { RuneId } from './runeid';
import { u128, u32 } from './integer';

export type Edict = {
  id: RuneId;
  amount: u128;
  output: u32;
};

export namespace Edict {
  export function fromIntegers(
    numOutputs: number,
    id: RuneId,
    amount: u128,
    output: u128
  ): Option<Edict> {
    if (id.block === 0n && id.tx > 0n) {
      return None;
    }

    const optionOutputU32 = u128.tryIntoU32(output);
    if (optionOutputU32.isNone()) {
      return None;
    }
    const outputU32 = optionOutputU32.unwrap();

    if (outputU32 > numOutputs) {
      return None;
    }

    return Some({ id, amount, output: outputU32 });
  }
}
