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
    unchanged: Array<{ old: Vout; new: Vout; index: number }>;
  };
  metrics: {
    feeDelta: number | null;      // null if unchanged
    weightDelta: number | null;   // null if unchanged
    // vsize is weight / 4, so it is covered by weightDelta and not tracked separately
  };
}

interface OutputEntry {
  out: Vout;
  index: number;
  matched: boolean;
  outputId: string;
}

/**
 * A FIFO of candidate outputs sharing a key. Keeping the original order and a
 * cursor means popping returns the first still-unmatched candidate, exactly as a
 * linear scan would, without re-walking the whole list for every output.
 */
interface CandidateQueue {
  entries: OutputEntry[];
  cursor: number;
}

function indexBy(entries: OutputEntry[], keyOf: (entry: OutputEntry) => string): Map<string, CandidateQueue> {
  const index = new Map<string, CandidateQueue>();
  for (const entry of entries) {
    const key = keyOf(entry);
    const queue = index.get(key);
    if (queue) {
      queue.entries.push(entry);
    } else {
      index.set(key, { entries: [entry], cursor: 0 });
    }
  }
  return index;
}

function takeUnmatched(queue: CandidateQueue | undefined): OutputEntry | undefined {
  if (!queue) { return undefined; }
  while (queue.cursor < queue.entries.length && queue.entries[queue.cursor].matched) {
    queue.cursor++;
  }
  return queue.entries[queue.cursor];
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
  const unchangedOutputs: Array<{ old: Vout; new: Vout; index: number }> = [];

  // Annotate outputs with their original indices, a matched flag, and a stable match key
  // Use address when available; fallback to raw scriptpubkey for addressless outputs.
  const oldOutputs = oldTx.vout.map((out, index) => ({
    out,
    index,
    matched: false,
    outputId: out.scriptpubkey_address ?? `scriptpubkey:${out.scriptpubkey}`,
  }));
  const newOutputs = newTx.vout.map((out, index) => ({
    out,
    index,
    matched: false,
    outputId: out.scriptpubkey_address ?? `scriptpubkey:${out.scriptpubkey}`,
  }));
  // Candidate indexes, so each pass looks up its matches instead of rescanning
  // every remaining output for every output it has to place
  const byIdAndValue = indexBy(newOutputs, (entry) => `${entry.outputId}|${entry.out.value}`);
  const byId = indexBy(newOutputs, (entry) => entry.outputId);
  const byValue = indexBy(newOutputs, (entry) => `${entry.out.value}`);
  const byIndex = indexBy(newOutputs, (entry) => `${entry.index}`);
  let anyCursor = 0;

  // Pass 1: match truly unchanged outputs (same address AND value, regardless of position)
  for (const oldItem of oldOutputs) {
    const match = takeUnmatched(byIdAndValue.get(`${oldItem.outputId}|${oldItem.out.value}`));
    if (match) {
      oldItem.matched = true;
      match.matched = true;
      unchangedOutputs.push({ old: oldItem.out, new: match.out, index: oldItem.index });
    }
  }

  // Pass 2: same destination, different amount.
  for (const oldItem of oldOutputs) {
    if (oldItem.matched) { continue; }
    const match = takeUnmatched(byId.get(oldItem.outputId));
    if (!match) { continue; }
    oldItem.matched = true;
    match.matched = true;
    modifiedOutputs.push({ old: oldItem.out, new: match.out, index: oldItem.index, changeType: 'value' });
  }

  // Pass 3: match any still-unmatched outputs as best-effort (address changed).
  // Prefer a leftover of equal value — a pure destination swap keeps the amount —
  // then one at the same index, before falling back to document order.
  for (const oldItem of oldOutputs) {
    if (oldItem.matched) { continue; }
    let match =
      takeUnmatched(byValue.get(`${oldItem.out.value}`)) ??
      takeUnmatched(byIndex.get(`${oldItem.index}`));
    if (!match) {
      while (anyCursor < newOutputs.length && newOutputs[anyCursor].matched) { anyCursor++; }
      match = newOutputs[anyCursor];
    }
    if (!match) { continue; }
    oldItem.matched = true;
    match.matched = true;
    // Compare the stable output id, not the address: two different addressless
    // scripts (OP_RETURN and friends) both have an undefined address, which would
    // otherwise report a script replacement as an unchanged destination.
    const addressChanged = oldItem.outputId !== match.outputId;
    const valueChanged = oldItem.out.value !== match.out.value;
    // Anything reaching this pass had no same-id candidate left, so the
    // destination necessarily differs; only the value may or may not have moved.
    const changeType: 'address' | 'both' = addressChanged && valueChanged ? 'both' : 'address';
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
      unchanged: unchangedOutputs,
    },
    metrics: {
      feeDelta: feeDelta !== 0 ? feeDelta : null,
      weightDelta: weightDelta !== 0 ? weightDelta : null,
    },
  };
}
