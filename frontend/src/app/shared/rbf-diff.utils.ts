import { Transaction, Vin, Vout } from '@interfaces/electrs.interface';

export interface RbfDiff {
  transaction: {
    versionChanged: boolean;
    locktimeChanged: boolean;
    oldVersion: number;
    newVersion: number;
    oldLocktime: number;
    newLocktime: number;
  };
  inputs: {
    added: Vin[];
    removed: Vin[];
    unchanged: Array<{ old: Vin; new: Vin }>;
  };
  outputs: {
    added: Vout[];
    removed: Vout[];
    modified: Array<{ old: Vout; new: Vout; index: number; changeType: 'address' | 'value' | 'both' }>;
    feeAdjusted: Array<{ old: Vout; new: Vout; index: number }>; // Value reduced by exactly feeDelta
    unchanged: Array<{ old: Vout; new: Vout; index: number }>;
  };
  metrics: {
    feeDelta: number | null;      // null if unchanged
    weightDelta: number | null;   // null if unchanged
    vsizeDelta: number | null;    // null if unchanged
  };
}

// Compares structural differences between an original transaction and its RBF replacement

export function calculateRbfDiff(oldTx: Transaction, newTx: Transaction): RbfDiff {
  const feeDelta = newTx.fee - oldTx.fee;

  // TRANSACTION METADATA
  const versionChanged = oldTx.version !== newTx.version;
  const locktimeChanged = oldTx.locktime !== newTx.locktime;

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

  // OUTPUT COMPARISON (ENHANCED LOGIC)
  const addedOutputs: Vout[] = [];
  const removedOutputs: Vout[] = [];
  const modifiedOutputs: Array<{ old: Vout; new: Vout; index: number; changeType: 'address' | 'value' | 'both' }> = [];
  const feeAdjustedOutputs: Array<{ old: Vout; new: Vout; index: number }> = [];
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
      const addressChanged = oldOut.scriptpubkey_address !== newOut.scriptpubkey_address;
      const valueChanged = oldOut.value !== newOut.value;

      if (!addressChanged && !valueChanged) {
        // Truly unchanged
        unchangedOutputs.push({ old: oldOut, new: newOut, index: i });
      } else if (!addressChanged && valueChanged) {
        // Same address, value changed
        const valueDelta = oldOut.value - newOut.value;

        // Check if this is just a fee adjustment
        // If the value decreased by exactly the feeDelta, it's a fee-adjusted output
        if (valueDelta === feeDelta && feeDelta > 0) {
          feeAdjustedOutputs.push({ old: oldOut, new: newOut, index: i });
        } else {
          modifiedOutputs.push({
            old: oldOut,
            new: newOut,
            index: i,
            changeType: 'value'
          });
        }
      } else if (addressChanged && !valueChanged) {
        modifiedOutputs.push({
          old: oldOut,
          new: newOut,
          index: i,
          changeType: 'address'
        });
      } else {
        // Both changed
        modifiedOutputs.push({
          old: oldOut,
          new: newOut,
          index: i,
          changeType: 'both'
        });
      }
    }
  }

  // METRICS (only include if changed)
  const weightDelta = newTx.weight - oldTx.weight;
  const vsizeDelta = newTx.size - oldTx.size;

  return {
    transaction: {
      versionChanged,
      locktimeChanged,
      oldVersion: oldTx.version,
      newVersion: newTx.version,
      oldLocktime: oldTx.locktime,
      newLocktime: newTx.locktime,
    },
    inputs: {
      added: addedInputs,
      removed: removedInputs,
      unchanged: unchangedInputs,
    },
    outputs: {
      added: addedOutputs,
      removed: removedOutputs,
      modified: modifiedOutputs,
      feeAdjusted: feeAdjustedOutputs,
      unchanged: unchangedOutputs,
    },
    metrics: {
      feeDelta: feeDelta !== 0 ? feeDelta : null,
      weightDelta: weightDelta !== 0 ? weightDelta : null,
      vsizeDelta: vsizeDelta !== 0 ? vsizeDelta : null,
    },
  };
}
