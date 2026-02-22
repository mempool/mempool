import { Component, Input, OnInit, OnChanges, Inject, LOCALE_ID, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { RbfTree, RbfTransaction } from '@interfaces/node-api.interface';
import { StateService } from '@app/services/state.service';
import { ApiService } from '@app/services/api.service';
import { forkJoin } from 'rxjs';
import { Transaction } from '@interfaces/electrs.interface';
import { calculateRbfDiff, RbfDiff } from '@app/shared/rbf-diff.utils';

type Connector = 'pipe' | 'corner';

interface TimelineCell {
  replacement?: RbfTree,
  connector?: Connector,
  first?: boolean,
  fullRbf?: boolean,
}

/**
 * Represents a single row in the comparison table
 * Each row shows: label, previous value, current value, and optional highlighting
 */
interface ComparisonRow {
  label: string;                    // e.g., "Version", "Locktime", "Fee"
  previous: string | number | null; // Value from old transaction
  current: string | number | null;  // Value from new transaction
  changed: boolean;                 // Whether the value changed
  changeType?: 'positive' | 'negative' | 'neutral'; // For styling
  i18nKey?: string;                 // For internationalization
  percentage?: number | null;       // Pre-calculated percentage change
  isAmount?: boolean;               // Whether this row displays an amount (for app-amount component)
  unit?: string;                    // Unit label for metrics (e.g., 'WU', 'vB')
}

/**
 * Represents a comparison section (metadata, metrics, inputs, outputs)
 */
interface ComparisonSection {
  title: string;
  rows: ComparisonRow[];
  hasChanges: boolean; // Whether any row in this section changed
}

/**
 * Complete comparison table data structure
 */
interface ComparisonTableData {
  metadata: ComparisonSection;  // Version, Locktime
  metrics: ComparisonSection;   // Fee, Weight, vSize
  inputs: ComparisonSection;    // Input changes summary
  outputs: ComparisonSection;   // Output changes summary
}

function isTimelineCell(val: RbfTree | TimelineCell): boolean {
  return !val || !('tx' in val);
}

@Component({
  selector: 'app-rbf-timeline',
  templateUrl: './rbf-timeline.component.html',
  styleUrls: ['./rbf-timeline.component.scss'],
  standalone: false,
})
export class RbfTimelineComponent implements OnInit, OnChanges {
  @Input() replacements: RbfTree;
  @Input() txid: string;
  @Input() rowLimit: number = 5; // If explicitly set to 0, all timelines rows will be displayed by default
  rows: TimelineCell[][] = [];
  timelineExpanded: boolean = this.rowLimit === 0;

  hoverInfo: RbfTree | null = null;
  tooltipPosition = null;

  dir: 'rtl' | 'ltr' = 'ltr';

  // RBF Diff state
  selectedOldTx: Transaction | null = null;
  selectedNewTx: Transaction | null = null;
  rbfDiff: RbfDiff | null = null;
  showDiff: boolean = false;
  comparisonData: ComparisonTableData | null = null;

  constructor(
    private router: Router,
    private stateService: StateService,
    private apiService: ApiService,
    @Inject(LOCALE_ID) private locale: string,
  ) {
    if (this.locale.startsWith('ar') || this.locale.startsWith('fa') || this.locale.startsWith('he')) {
      this.dir = 'rtl';
    }
  }

  ngOnInit(): void {
    this.rows = this.buildTimelines(this.replacements);
  }

  ngOnChanges(changes): void {
    this.rows = this.buildTimelines(this.replacements);
    if (changes.txid && !changes.txid.firstChange && changes.txid.previousValue !== changes.txid.currentValue) {
      setTimeout(() => { this.scrollToSelected(); });
    }
  }

  // converts a tree of RBF events into a format that can be more easily rendered in HTML
  buildTimelines(tree: RbfTree): TimelineCell[][] {
    if (!tree) {return [];}

    this.flagFullRbf(tree);
    const split = this.splitTimelines(tree);
    const timelines = this.prepareTimelines(split);
    return this.connectTimelines(timelines);
  }

  // sets the fullRbf flag on each transaction in the tree
  flagFullRbf(tree: RbfTree): void {
    let fullRbf = false;
    for (const replaced of tree.replaces) {
      if (!replaced.tx.rbf) {
        fullRbf = true;
      }
      replaced.replacedBy = tree.tx;
      this.flagFullRbf(replaced);
    }
    tree.tx.fullRbf = fullRbf;
  }

  // splits a tree into N leaf-to-root paths
  splitTimelines(tree: RbfTree, tail: RbfTree[] = []): RbfTree[][] {
    const replacements = [...tail, tree];
    if (tree.replaces.length) {
      return [].concat(...tree.replaces.map(subtree => this.splitTimelines(subtree, replacements)));
    } else {
      return [[...replacements]];
    }
  }

  // merges separate leaf-to-root paths into a coherent forking timeline
  // represented as a 2D array of Rbf events
  prepareTimelines(lines: RbfTree[][]): (RbfTree | TimelineCell)[][] {
    lines.sort((a, b) => b.length - a.length);

    const rows = lines.map(() => []);
    let lineGroups = [lines];
    let done = false;
    let column = 0; // sanity check for while loop stopping condition
    while (!done && column < 100) {
      // iterate over timelines element-by-element
      // at each step, group lines which share a common transaction at their head
      // (i.e. lines terminating in the same replacement event)
      let index = 0;
      let emptyCount = 0;
      const nextGroups = [];
      for (const group of lineGroups) {
        const toMerge: { [txid: string]: RbfTree[][] } = {};
        let emptyInGroup = 0;
        let first = true;
        for (const line of group) {
          const head = line.shift() || null;
          if (first) {
            // only insert the first instance of the replacement node
            rows[index].unshift(head);
            first = false;
          } else {
            // substitute duplicates with empty cells
            // (we'll fill these in with connecting lines later)
            rows[index].unshift({ connector: true, replacement: head });
          }
          // group the tails of the remaining lines for the next iteration
          if (line.length) {
            const nextId = line[0].tx.txid;
            if (!toMerge[nextId]) {
              toMerge[nextId] = [];
            }
            toMerge[nextId].push(line);
          } else {
            emptyInGroup++;
          }
          index++;
        }
        for (const merged of Object.values(toMerge).sort((a, b) => b.length - a.length)) {
          nextGroups.push(merged);
        }
        for (let i = 0; i < emptyInGroup; i++) {
          nextGroups.push([[]]);
        }
        emptyCount += emptyInGroup;
        lineGroups = nextGroups;
        done = (emptyCount >= rows.length);
      }
      column++;
    }
    return rows;
  }

  // annotates a 2D timeline array with info needed to draw connecting lines for multi-replacements
  connectTimelines(timelines: (RbfTree | TimelineCell)[][]): TimelineCell[][] {
    const rows: TimelineCell[][] = [];
    timelines.forEach((lines, row) => {
      rows.push([]);
      let started = false;
      let finished = false;
      lines.forEach((replacement, column) => {
        const cell: TimelineCell = {};
        if (!isTimelineCell(replacement)) {
          cell.replacement = replacement as RbfTree;
          cell.fullRbf = (replacement as RbfTree).replacedBy?.fullRbf;
        }
        rows[row].push(cell);
        if (!isTimelineCell(replacement)) {
          if (!started) {
            cell.first = true;
            started = true;
          }
        } else if (started && !finished) {
          if (column < timelines[row].length) {
            let matched = false;
            for (let i = row; i >= 0 && !matched; i--) {
              const nextCell = rows[i][column];
              if (nextCell.replacement) {
                matched = true;
              } else if (i === row) {
                rows[i][column] = {
                  connector: 'corner',
                  fullRbf: (replacement as TimelineCell).replacement.tx.fullRbf,
                };
              } else if (nextCell.connector !== 'corner') {
                rows[i][column] = {
                  connector: 'pipe',
                  fullRbf: (replacement as TimelineCell).replacement.tx.fullRbf,
                };
              }
            }
          }
          finished = true;
        }
      });
    });
    return rows;
  }

  toggleTimeline(expand: boolean): void {
    this.timelineExpanded = expand;
  }

  scrollToSelected() {
    const node = document.getElementById('node-' + this.txid);
    if (node) {
      node.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event) {
    this.tooltipPosition = { x: event.clientX, y: event.clientY };
  }

  onHover(event, replacement): void {
    this.hoverInfo = replacement;
  }

  onBlur(event): void {
    this.hoverInfo = null;
  }

  /**
    Fetches full transaction details for two transactions and computes their structural diff
    @param oldTxid - The original transaction ID
    @param newTxid - The replacement transaction ID
   */
  compareTxs(oldTxid: string, newTxid: string): void {
    forkJoin({
      oldTx: this.apiService.getRbfCachedTx$(oldTxid),
      newTx: this.apiService.getRbfCachedTx$(newTxid),
    }).subscribe(({ oldTx, newTx }) => {
      this.selectedOldTx = oldTx;
      this.selectedNewTx = newTx;
      this.rbfDiff = calculateRbfDiff(oldTx, newTx);
      this.prepareComparisonTable();
      this.showDiff = true;
    });
  }

  closeDiff(): void {
    this.showDiff = false;
    this.selectedOldTx = null;
    this.selectedNewTx = null;
    this.rbfDiff = null;
    this.comparisonData = null;
  }

  /**
   * Prepares the RBF diff data into a block-audit-style comparison table structure
   * FIXED: Only includes changed rows, calculates deltas in TypeScript, correct units
   */
  prepareComparisonTable(): void {
    if (!this.rbfDiff || !this.selectedOldTx || !this.selectedNewTx) {
      return;
    }

    // ========================================
    // METADATA SECTION - Only add if changed
    // ========================================
    const metadataRows: ComparisonRow[] = [];

    if (this.rbfDiff.transaction.versionChanged) {
      metadataRows.push({
        label: 'Version',
        i18nKey: 'transaction.version',
        previous: this.rbfDiff.transaction.oldVersion,
        current: this.rbfDiff.transaction.newVersion,
        changed: true,
        changeType: 'neutral'
      });
    }

    if (this.rbfDiff.transaction.locktimeChanged) {
      metadataRows.push({
        label: 'Locktime',
        i18nKey: 'transaction.locktime',
        previous: this.rbfDiff.transaction.oldLocktime,
        current: this.rbfDiff.transaction.newLocktime,
        changed: true,
        changeType: 'neutral'
      });
    }

    // ========================================
    // METRICS SECTION - Only metrics that changed
    // ========================================
    const metricsRows: ComparisonRow[] = [];

    // Fee (always changed if in this section)
    if (this.rbfDiff.metrics.feeDelta !== null) {
      const oldFee = this.selectedOldTx.fee;
      const newFee = this.selectedNewTx.fee;
      const feePercentage = oldFee > 0 ? ((newFee - oldFee) / oldFee) * 100 : null;

      metricsRows.push({
        label: 'Fee',
        i18nKey: 'transaction.fee',
        previous: oldFee,
        current: newFee,
        changed: true,
        changeType: this.rbfDiff.metrics.feeDelta > 0 ? 'negative' : 'positive',
        percentage: feePercentage,
        isAmount: true
      });
    }

    // Weight (with percentage)
    if (this.rbfDiff.metrics.weightDelta !== null) {
      const oldWeight = this.selectedOldTx.weight;
      const newWeight = this.selectedNewTx.weight;
      const weightPercentage = oldWeight > 0 ? ((newWeight - oldWeight) / oldWeight) * 100 : null;

      metricsRows.push({
        label: 'Weight',
        i18nKey: 'transaction.weight',
        previous: oldWeight,
        current: newWeight,
        changed: true,
        changeType: this.rbfDiff.metrics.weightDelta > 0 ? 'negative' : 'positive',
        percentage: weightPercentage,
        isAmount: false,
        unit: 'WU'
      });
    }

    // Virtual size (with percentage) - FIXED: unit is vB
    if (this.rbfDiff.metrics.vsizeDelta !== null) {
      const oldVsize = this.selectedOldTx.size;
      const newVsize = this.selectedNewTx.size;
      const vsizePercentage = oldVsize > 0 ? ((newVsize - oldVsize) / oldVsize) * 100 : null;

      metricsRows.push({
        label: 'Virtual size',
        i18nKey: 'transaction.vsize',
        previous: oldVsize,
        current: newVsize,
        changed: true,
        changeType: this.rbfDiff.metrics.vsizeDelta > 0 ? 'negative' : 'positive',
        percentage: vsizePercentage,
        isAmount: false,
        unit: 'vB'
      });
    }

    // ========================================
    // INPUTS SECTION - FIXED: Delta formatting in TypeScript
    // ========================================
    const inputsRows: ComparisonRow[] = [];

    const oldInputCount = this.selectedOldTx.vin.length;
    const newInputCount = this.selectedNewTx.vin.length;
    const inputDelta = newInputCount - oldInputCount;

    // Total Inputs - ONLY add if count changed, with formatted delta
    if (inputDelta !== 0) {
      const sign = inputDelta > 0 ? '+' : '';
      const formattedCurrent = `${newInputCount} (${sign}${inputDelta})`;

      inputsRows.push({
        label: 'Total Inputs',
        i18nKey: 'transaction.inputs-count',
        previous: oldInputCount,
        current: formattedCurrent,
        changed: true,
        changeType: 'neutral'
      });
    }

    // Added Inputs
    if (this.rbfDiff.inputs.added.length > 0) {
      inputsRows.push({
        label: 'Added Inputs',
        i18nKey: 'rbf-diff.inputs-added',
        previous: null,
        current: this.rbfDiff.inputs.added.length,
        changed: true,
        changeType: 'positive'
      });
    }

    // Removed Inputs
    if (this.rbfDiff.inputs.removed.length > 0) {
      inputsRows.push({
        label: 'Removed Inputs',
        i18nKey: 'rbf-diff.inputs-removed',
        previous: this.rbfDiff.inputs.removed.length,
        current: null,
        changed: true,
        changeType: 'negative'
      });
    }

    // ========================================
    // OUTPUTS SECTION - FIXED: Delta formatting in TypeScript
    // ========================================
    const outputsRows: ComparisonRow[] = [];

    const oldOutputCount = this.selectedOldTx.vout.length;
    const newOutputCount = this.selectedNewTx.vout.length;
    const outputDelta = newOutputCount - oldOutputCount;

    // Total Outputs - ONLY add if count changed, with formatted delta
    if (outputDelta !== 0) {
      const sign = outputDelta > 0 ? '+' : '';
      const formattedCurrent = `${newOutputCount} (${sign}${outputDelta})`;

      outputsRows.push({
        label: 'Total Outputs',
        i18nKey: 'transaction.outputs-count',
        previous: oldOutputCount,
        current: formattedCurrent,
        changed: true,
        changeType: 'neutral'
      });
    }

    // Added Outputs
    if (this.rbfDiff.outputs.added.length > 0) {
      outputsRows.push({
        label: 'Added Outputs',
        i18nKey: 'rbf-diff.outputs-added',
        previous: null,
        current: this.rbfDiff.outputs.added.length,
        changed: true,
        changeType: 'positive'
      });
    }

    // Removed Outputs
    if (this.rbfDiff.outputs.removed.length > 0) {
      outputsRows.push({
        label: 'Removed Outputs',
        i18nKey: 'rbf-diff.outputs-removed',
        previous: this.rbfDiff.outputs.removed.length,
        current: null,
        changed: true,
        changeType: 'negative'
      });
    }

    // Modified Outputs
    if (this.rbfDiff.outputs.modified.length > 0) {
      outputsRows.push({
        label: 'Modified Outputs',
        i18nKey: 'rbf-diff.outputs-modified',
        previous: null,
        current: this.rbfDiff.outputs.modified.length,
        changed: true,
        changeType: 'neutral'
      });
    }

    // Fee-Adjusted Outputs
    if (this.rbfDiff.outputs.feeAdjusted.length > 0) {
      outputsRows.push({
        label: 'Fee-Adjusted Outputs',
        i18nKey: 'rbf-diff.outputs-fee-adjusted',
        previous: null,
        current: this.rbfDiff.outputs.feeAdjusted.length,
        changed: true,
        changeType: 'neutral'
      });
    }

    // ========================================
    // CONSTRUCT FINAL DATA - hasChanges based on row count
    // ========================================
    this.comparisonData = {
      metadata: {
        title: 'Transaction Metadata',
        rows: metadataRows,
        hasChanges: metadataRows.length > 0
      },
      metrics: {
        title: 'Metrics',
        rows: metricsRows,
        hasChanges: metricsRows.length > 0
      },
      inputs: {
        title: 'Inputs',
        rows: inputsRows,
        hasChanges: inputsRows.length > 0
      },
      outputs: {
        title: 'Outputs',
        rows: outputsRows,
        hasChanges: outputsRows.length > 0
      }
    };
  }

  /**
   * Type-safe helper to convert comparison row values to numbers
   * Used for app-amount component which requires strict number type
   */
  asNumber(value: any): number {
    return value as number;
  }

  // Finds the RbfTree node for the currently viewed transaction

  private findCurrentNode(tree: RbfTree): RbfTree | null {
    if (!tree) { return null; }
    if (tree.tx.txid === this.txid) {
      return tree;
    }
    for (const replaced of tree.replaces) {
      const found = this.findCurrentNode(replaced);
      if (found) { return found; }
    }
    return null;
  }

  // Gets the immediate predecessor (transaction that was replaced) for the current txid

  getPredecessorTxid(): string | null {
    const currentNode = this.findCurrentNode(this.replacements);
    if (currentNode && currentNode.replaces.length > 0) {
      return currentNode.replaces[0].tx.txid;
    }
    return null;
  }

  // Toggles the structural diff visibility
  toggleStructuralDiff(): void {
    if (this.showDiff) {
      this.closeDiff();
    } else {
      const predecessorTxid = this.getPredecessorTxid();
      if (predecessorTxid && this.txid) {
        this.compareTxs(predecessorTxid, this.txid);
      }
    }
  }
}
