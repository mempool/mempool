import { Transaction, Vin, Vout } from '@interfaces/electrs.interface';

/**
 * What differs between a transaction and the one that replaced it. Deliberately
 * limited to what the diff table consumes: a field nobody reads is a field that
 * drifts out of sync without anyone noticing.
 */
interface RbfDiff {
  transaction: {
    versionChanged: boolean;
    locktimeChanged: boolean;
  };
  inputs: {
    added: Vin[];
    removed: Vin[];
  };
  outputs: {
    added: Vout[];
    removed: Vout[];
    modified: Array<{ old: Vout; new: Vout; changeType: 'address' | 'value' | 'both' }>;
  };
}

/**
 * One output of the replacement, rendered as a single row with the previous and
 * the new destination side by side. An added or removed output has nothing on
 * one side and gets a placeholder there.
 */
export interface OutputDiffRow {
  previous: Vout | null;
  current: Vout | null;
  addressChanged: boolean;
  // the destination survived the replacement, so the table shows it once across
  // both columns instead of printing the same address twice
  sameAddress: boolean;
}

/**
 * Everything the diff table renders. A field is only flagged when it actually
 * changed, so unchanged rows never reach the template.
 */
export interface RbfDiffView {
  versionChanged: boolean;
  locktimeChanged: boolean;
  feeChanged: boolean;
  feePercent: number | null;
  feeIncreased: boolean;
  feeRateChanged: boolean;
  weightChanged: boolean;
  weightPercent: number | null;
  weightIncreased: boolean;
  inputsChanged: boolean;
  inputsDelta: string;
  outputsChanged: boolean;
  outputsDelta: string;
  outputRows: OutputDiffRow[];
}

interface OutputEntry {
  out: Vout;
  index: number;
  matched: boolean;
  outputId: string;
}

/**
 * Groups candidate outputs by key, keeping the original order. Reading the head then gives
 * the first unmatched candidate for that key, exactly as a linear scan would, without
 * re-walking the whole list for every output.
 */
function indexBy(entries: OutputEntry[], keyOf: (entry: OutputEntry) => string): Map<string, OutputEntry[]> {
  const index = new Map<string, OutputEntry[]>();
  for (const entry of entries) {
    const key = keyOf(entry);
    const queue = index.get(key);
    if (queue) {
      queue.push(entry);
    } else {
      index.set(key, [entry]);
    }
  }
  return index;
}

/**
 * Peeks at the head of a queue, discarding anything already spoken for. The head
 * itself is left in place: an entry appears in several indexes at once, so the
 * only thing that retires it is the caller setting `matched`.
 */
function takeUnmatched(queue: OutputEntry[] | undefined): OutputEntry | undefined {
  if (!queue) { return undefined; }
  while (queue.length && queue[0].matched) {
    queue.shift();
  }
  return queue[0];
}

// Annotates outputs with their original index, a matched flag, and a stable match
// key. Uses the address when there is one, falling back to the raw scriptpubkey
// for addressless outputs.
function annotate(vouts: Vout[]): OutputEntry[] {
  return vouts.map((out, index) => ({
    out,
    index,
    matched: false,
    outputId: out.scriptpubkey_address ?? `scriptpubkey:${out.scriptpubkey}`,
  }));
}

// Compares structural differences between an original transaction and its RBF replacement
function calculateRbfDiff(oldTx: Transaction, newTx: Transaction): RbfDiff {
  // INPUT COMPARISON
  const keyOf = (vin: Vin): string => `${vin.txid}:${vin.vout}`;
  const oldKeys = new Set(oldTx.vin.map(keyOf));
  const newKeys = new Set(newTx.vin.map(keyOf));

  const addedInputs = newTx.vin.filter((vin) => !oldKeys.has(keyOf(vin)));
  const removedInputs = oldTx.vin.filter((vin) => !newKeys.has(keyOf(vin)));

  // OUTPUT COMPARISON (CONTENT-BASED MATCHING)
  const addedOutputs: Vout[] = [];
  const removedOutputs: Vout[] = [];
  const modifiedOutputs: Array<{ old: Vout; new: Vout; changeType: 'address' | 'value' | 'both' }> = [];

  const oldOutputs = annotate(oldTx.vout);
  const newOutputs = annotate(newTx.vout);

  // Candidate indexes, so each pass looks up its matches instead of rescanning
  // every remaining output for every output it has to place
  const byIdAndValue = indexBy(newOutputs, (entry) => `${entry.outputId}|${entry.out.value}`);
  const byId = indexBy(newOutputs, (entry) => entry.outputId);
  const byValue = indexBy(newOutputs, (entry) => `${entry.out.value}`);
  let anyCursor = 0;

  // Pass 1: match truly unchanged outputs (same address AND value, regardless of position)
  for (const oldItem of oldOutputs) {
    const match = takeUnmatched(byIdAndValue.get(`${oldItem.outputId}|${oldItem.out.value}`));
    if (match) {
      oldItem.matched = true;
      match.matched = true;
    }
  }

  // Pass 2: same destination, different amount.
  for (const oldItem of oldOutputs) {
    if (oldItem.matched) { continue; }
    const match = takeUnmatched(byId.get(oldItem.outputId));
    if (!match) { continue; }
    oldItem.matched = true;
    match.matched = true;
    modifiedOutputs.push({ old: oldItem.out, new: match.out, changeType: 'value' });
  }

  // Pass 3: match any still-unmatched outputs as best-effort (address changed).
  // Prefer a leftover of equal value — a pure destination swap keeps the amount —
  // then the one at the same position, before falling back to document order.
  for (const oldItem of oldOutputs) {
    if (oldItem.matched) { continue; }
    const atSameIndex = newOutputs[oldItem.index];
    let match =
      takeUnmatched(byValue.get(`${oldItem.out.value}`)) ??
      (atSameIndex && !atSameIndex.matched ? atSameIndex : undefined);
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
    modifiedOutputs.push({ old: oldItem.out, new: match.out, changeType });
  }

  // Pass 4: remaining unmatched old = removed, remaining unmatched new = added
  for (const oldItem of oldOutputs) {
    if (!oldItem.matched) { removedOutputs.push(oldItem.out); }
  }
  for (const newItem of newOutputs) {
    if (!newItem.matched) { addedOutputs.push(newItem.out); }
  }

  return {
    transaction: {
      versionChanged: oldTx.version !== newTx.version,
      locktimeChanged: oldTx.locktime !== newTx.locktime,
    },
    inputs: {
      added: addedInputs,
      removed: removedInputs,
    },
    outputs: {
      added: addedOutputs,
      removed: removedOutputs,
      modified: modifiedOutputs,
    },
  };
}

/**
 * Reads as "(+2 −1)". Reporting how many were added and how many removed rather
 * than the net keeps a swap visible: replacing one input with another leaves the
 * total untouched, which a net delta would report as no change.
 */
function formatCountDelta(added: number, removed: number): string {
  const parts: string[] = [];
  if (added > 0) {
    parts.push(`+${added}`);
  }
  if (removed > 0) {
    parts.push(`−${removed}`);
  }
  return parts.length ? `(${parts.join(' ')})` : '';
}

/**
 * Cross multiplied rather than comparing two divisions, so a rate that did not
 * really move can never read as changed because of a rounding artefact. The
 * products can pass the safe integer range for a large fee, hence BigInt.
 */
function feeRateChanged(oldTx: Transaction, newTx: Transaction): boolean {
  return BigInt(Math.round(oldTx.fee)) * BigInt(newTx.weight)
    !== BigInt(Math.round(newTx.fee)) * BigInt(oldTx.weight);
}

/**
 * Reduces the structural diff to just what the table renders. Rows for unchanged
 * fields are left out entirely rather than rendered as noise.
 */
export function buildRbfDiffView(oldTx: Transaction, newTx: Transaction): RbfDiffView {
  const diff = calculateRbfDiff(oldTx, newTx);

  // Most important first: a replaced destination is the reason to look at all
  const outputRows: OutputDiffRow[] = [
    ...diff.outputs.modified
      .filter(m => m.changeType !== 'value')
      .map(m => ({ previous: m.old, current: m.new, addressChanged: true })),
    ...diff.outputs.modified
      .filter(m => m.changeType === 'value')
      .map(m => ({ previous: m.old, current: m.new, addressChanged: false })),
    ...diff.outputs.removed
      .map(out => ({ previous: out, current: null, addressChanged: false })),
    ...diff.outputs.added
      .map(out => ({ previous: null, current: out, addressChanged: false })),
  ].map(row => ({
    // derived rather than set per case, so the two shapes can never disagree.
    // An added or removed output keeps its column: which side it is missing
    // from is the whole point of that row.
    ...row,
    sameAddress: !!row.previous && !!row.current && !row.addressChanged,
  }));

  const addedInputs = diff.inputs.added.length;
  const removedInputs = diff.inputs.removed.length;
  const addedOutputs = diff.outputs.added.length;
  const removedOutputs = diff.outputs.removed.length;

  return {
    versionChanged: diff.transaction.versionChanged,
    locktimeChanged: diff.transaction.locktimeChanged,
    feeChanged: oldTx.fee !== newTx.fee,
    feePercent: oldTx.fee > 0 ? ((newTx.fee - oldTx.fee) / oldTx.fee) * 100 : null,
    feeIncreased: newTx.fee > oldTx.fee,
    feeRateChanged: feeRateChanged(oldTx, newTx),
    weightChanged: oldTx.weight !== newTx.weight,
    weightPercent: oldTx.weight > 0 ? ((newTx.weight - oldTx.weight) / oldTx.weight) * 100 : null,
    weightIncreased: newTx.weight > oldTx.weight,
    // an input can be swapped for another without the total moving, so the
    // count alone can't decide whether the row is worth showing
    inputsChanged: oldTx.vin.length !== newTx.vin.length || addedInputs > 0 || removedInputs > 0,
    inputsDelta: formatCountDelta(addedInputs, removedInputs),
    outputsChanged: oldTx.vout.length !== newTx.vout.length || addedOutputs > 0 || removedOutputs > 0,
    outputsDelta: formatCountDelta(addedOutputs, removedOutputs),
    outputRows,
  };
}
