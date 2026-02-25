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
    unchanged: Vin[];
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
  const unchangedInputs: Vin[] = [];

  newInputs.forEach((newInput, key) => {
    if (oldInputs.has(key)) {
      unchangedInputs.push(newInput.vin);
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

  // OUTPUT COMPARISON (CONTENT-BASED MATCHING)
  const addedOutputs: Vout[] = [];
  const removedOutputs: Vout[] = [];
  const modifiedOutputs: Array<{ old: Vout; new: Vout; index: number; changeType: 'address' | 'value' | 'both' }> = [];
  const feeAdjustedOutputs: Array<{ old: Vout; new: Vout; index: number }> = [];
  const unchangedOutputs: Array<{ old: Vout; new: Vout; index: number }> = [];

  // Annotate outputs with their original indices and a matched flag
  const oldOutputs = oldTx.vout.map((out, index) => ({ out, index, matched: false }));
  const newOutputs = newTx.vout.map((out, index) => ({ out, index, matched: false }));

  // Pass 1: match truly unchanged outputs (same address AND value, regardless of position)
  for (const oldItem of oldOutputs) {
    const match = newOutputs.find(
      (newItem) =>
        !newItem.matched &&
        oldItem.out.scriptpubkey_address === newItem.out.scriptpubkey_address &&
        oldItem.out.value === newItem.out.value
    );
    if (match) {
      oldItem.matched = true;
      match.matched = true;
      unchangedOutputs.push({ old: oldItem.out, new: match.out, index: oldItem.index });
    }
  }

  // Pass 2: match remaining outputs by address to detect fee-adjusted or value-modified outputs
  for (const oldItem of oldOutputs) {
    if (oldItem.matched) { continue; }
    const match = newOutputs.find(
      (newItem) =>
        !newItem.matched &&
        oldItem.out.scriptpubkey_address === newItem.out.scriptpubkey_address
    );
    if (!match) { continue; }
    oldItem.matched = true;
    match.matched = true;
    const valueDelta = oldItem.out.value - match.out.value;
    // Only classify as fee-adjusted if this looks like a change output (address unique in both txs),
    // to avoid false positives from unrelated outputs that coincidentally match the fee delta.
    const addr = oldItem.out.scriptpubkey_address;
    const isLikelyChangeOutput =
      !!addr &&
      oldTx.vout.filter(o => o.scriptpubkey_address === addr).length === 1 &&
      newTx.vout.filter(o => o.scriptpubkey_address === addr).length === 1;
    if (valueDelta === feeDelta && feeDelta > 0 && isLikelyChangeOutput) {
      feeAdjustedOutputs.push({ old: oldItem.out, new: match.out, index: oldItem.index });
    } else {
      modifiedOutputs.push({ old: oldItem.out, new: match.out, index: oldItem.index, changeType: 'value' });
    }
  }

  // Pass 3: match any still-unmatched outputs as best-effort (address changed)
  for (const oldItem of oldOutputs) {
    if (oldItem.matched) { continue; }
    const match = newOutputs.find((newItem) => !newItem.matched);
    if (!match) { continue; }
    oldItem.matched = true;
    match.matched = true;
    const addressChanged = oldItem.out.scriptpubkey_address !== match.out.scriptpubkey_address;
    const valueChanged = oldItem.out.value !== match.out.value;
    const changeType: 'address' | 'value' | 'both' =
      addressChanged && valueChanged ? 'both' :
      addressChanged ? 'address' : 'value';
    modifiedOutputs.push({ old: oldItem.out, new: match.out, index: oldItem.index, changeType });
  }

  // Pass 4: remaining unmatched old = removed, remaining unmatched new = added
  for (const oldItem of oldOutputs) {
    if (!oldItem.matched) { removedOutputs.push(oldItem.out); }
  }
  for (const newItem of newOutputs) {
    if (!newItem.matched) { addedOutputs.push(newItem.out); }
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
