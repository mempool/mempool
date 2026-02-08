import { Transaction, Vin, Vout } from '@interfaces/electrs.interface';

export interface RbfDiff {
  inputs: {
    added: Vin[];
    removed: Vin[];
    unchanged: Array<{ old: Vin; new: Vin }>;
  };
  outputs: {
    added: Vout[];
    removed: Vout[];
    modified: Array<{ old: Vout; new: Vout; index: number }>;
    unchanged: Array<{ old: Vout; new: Vout; index: number }>;
  };
  metrics: {
    feeDelta: number;        // newTx.fee - oldTx.fee
    weightDelta: number;     // newTx.weight - oldTx.weight
    vsizeDelta: number;      // newTx.size - oldTx.size (vsize)
  };
}

// Compares structural differences between an original transaction and its RBF replacement

export function calculateRbfDiff(oldTx: Transaction, newTx: Transaction): RbfDiff {
  // INPUT COMPARISON
  const oldInputs = new Map(
    oldTx.vin.map((vin, idx) => [`${vin.txid}:${vin.vout}`, { vin, idx }])
  );
  const newInputs = new Map(
    newTx.vin.map((vin, idx) => [`${vin.txid}:${vin.vout}`, { vin, idx }])
  );

  const addedInputs: Vin[] = [];
  const unchangedInputs: Array<{ old: Vin; new: Vin }> = [];

  newInputs.forEach((newInput, key) => {
    if (oldInputs.has(key)) {
      unchangedInputs.push({ old: oldInputs.get(key).vin, new: newInput.vin });
    } else {
      addedInputs.push(newInput.vin);
    }
  });

  const removedInputs: Vin[] = [];
  oldInputs.forEach((oldInput, key) => {
    if (!newInputs.has(key)) {
      removedInputs.push(oldInput.vin);
    }
  });

  // OUTPUT COMPARISON
  const addedOutputs: Vout[] = [];
  const removedOutputs: Vout[] = [];
  const modifiedOutputs: Array<{ old: Vout; new: Vout; index: number }> = [];
  const unchangedOutputs: Array<{ old: Vout; new: Vout; index: number }> = [];

  const maxOutputs = Math.max(oldTx.vout.length, newTx.vout.length);

  for (let i = 0; i < maxOutputs; i++) {
    const oldOut = oldTx.vout[i];
    const newOut = newTx.vout[i];

    if (!oldOut && newOut) {
      addedOutputs.push(newOut);
    } else if (oldOut && !newOut) {
      removedOutputs.push(oldOut);
    } else if (oldOut && newOut) {
      // Check if address or value changed
      if (
        oldOut.scriptpubkey_address !== newOut.scriptpubkey_address ||
        oldOut.value !== newOut.value
      ) {
        modifiedOutputs.push({ old: oldOut, new: newOut, index: i });
      } else {
        unchangedOutputs.push({ old: oldOut, new: newOut, index: i });
      }
    }
  }

  // METRICS
  return {
    inputs: {
      added: addedInputs,
      removed: removedInputs,
      unchanged: unchangedInputs,
    },
    outputs: {
      added: addedOutputs,
      removed: removedOutputs,
      modified: modifiedOutputs,
      unchanged: unchangedOutputs,
    },
    metrics: {
      feeDelta: newTx.fee - oldTx.fee,
      weightDelta: newTx.weight - oldTx.weight,
      vsizeDelta: newTx.size - oldTx.size, 
    },
  };
}
