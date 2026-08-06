import { Component, Input, OnInit, OnChanges, OnDestroy, Inject, LOCALE_ID, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { RbfTree, RbfTransaction } from '@interfaces/node-api.interface';
import { StateService } from '@app/services/state.service';
import { ApiService } from '@app/services/api.service';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, switchMap, takeUntil } from 'rxjs/operators';
import { Transaction, Vout } from '@interfaces/electrs.interface';
import { calculateRbfDiff } from '@app/shared/rbf-diff.utils';

type Connector = 'pipe' | 'corner';

interface TimelineCell {
  replacement?: RbfTree,
  connector?: Connector,
  first?: boolean,
  fullRbf?: boolean,
}

/**
 * One output of the replacement, aligned across the Previous and Current tables.
 * Every row renders on both sides so the two tables stay in step; the side that
 * doesn't exist gets a placeholder.
 */
interface OutputDiffRow {
  previous: Vout | null;
  current: Vout | null;
  addressChanged: boolean;
  // value reduced by exactly the fee bump — not a real change to the output
  feeAdjusted: boolean;
}

/**
 * Everything the diff tables render. A field is only flagged when it actually
 * changed, so unchanged rows never reach the template.
 */
interface RbfDiffView {
  versionChanged: boolean;
  locktimeChanged: boolean;
  feeChanged: boolean;
  feePercent: number | null;
  feeIncreased: boolean;
  weightChanged: boolean;
  weightPercent: number | null;
  weightIncreased: boolean;
  inputCountChanged: boolean;
  addedInputs: number;
  removedInputs: number;
  outputCountChanged: boolean;
  outputRows: OutputDiffRow[];
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
export class RbfTimelineComponent implements OnInit, OnChanges, OnDestroy {
  @Input() replacements: RbfTree;
  @Input() txid: string;
  @Input() rowLimit: number = 5; // If explicitly set to 0, all timelines rows will be displayed by default
  // Owned by the parent so the toggle can live beside the section heading, the
  // same way the transaction flow diagram is driven from transaction.component
  @Input() showDiff: boolean = false;
  rows: TimelineCell[][] = [];
  timelineExpanded: boolean = this.rowLimit === 0;

  hoverInfo: RbfTree | null = null;
  tooltipPosition = null;

  dir: 'rtl' | 'ltr' = 'ltr';

  // RBF Diff state
  selectedOldTx: Transaction | null = null;
  selectedNewTx: Transaction | null = null;
  diffLoading: boolean = false;
  diffError: boolean = false;
  diffView: RbfDiffView | null = null;

  // The pair currently being diffed. Any two nodes in the tree can be compared,
  // not just adjacent ones, so both ends are tracked independently.
  diffOldTxid: string | null = null;
  diffNewTxid: string | null = null;
  // First half of a two-click selection, waiting for the user to pick the other end
  pendingAnchorTxid: string | null = null;

  private nodeIndex = new Map<string, RbfTree>();
  private destroy$ = new Subject<void>();
  // Comparisons go through one stream so a slower earlier request can never land
  // on top of a newer selection. A null request cancels whatever is in flight.
  private diffRequest$ = new Subject<{ oldTxid: string, newTxid: string } | null>();

  constructor(
    private router: Router,
    private stateService: StateService,
    private apiService: ApiService,
    @Inject(LOCALE_ID) private locale: string,
  ) {
    if (this.locale.startsWith('ar') || this.locale.startsWith('fa') || this.locale.startsWith('he')) {
      this.dir = 'rtl';
    }
    // subscribed here rather than in ngOnInit because ngOnChanges runs first and
    // can already have queued a comparison
    this.diffRequest$.pipe(
      switchMap((request) => request ? forkJoin({
        oldTx: this.apiService.getRbfCachedTx$(request.oldTxid).pipe(catchError(() => of(null))),
        newTx: this.apiService.getRbfCachedTx$(request.newTxid).pipe(catchError(() => of(null))),
      }) : of(null)),
      takeUntil(this.destroy$),
    ).subscribe((result) => {
      if (!result) {
        return; // cancelled by a newer selection
      }
      this.diffLoading = false;
      if (!result.oldTx || !result.newTx) {
        this.diffError = true;
        return;
      }
      this.selectedOldTx = result.oldTx;
      this.selectedNewTx = result.newTx;
      this.diffView = this.buildDiffView(result.oldTx, result.newTx);
    });
  }

  ngOnInit(): void {
    this.rows = this.buildTimelines(this.replacements);
    this.indexNodes();
    this.resolveDefaultPair(true);
  }

  ngOnChanges(changes): void {
    this.rows = this.buildTimelines(this.replacements);
    this.indexNodes();
    const txidChanged = changes.txid && changes.txid.previousValue !== changes.txid.currentValue;
    const previousPair = `${this.diffOldTxid}:${this.diffNewTxid}`;
    this.resolveDefaultPair(txidChanged);
    if (changes.showDiff) {
      this.pendingAnchorTxid = null;
      this.clearDiffResult();
      if (this.showDiff) {
        this.loadDiff();
      }
    } else if (this.showDiff && `${this.diffOldTxid}:${this.diffNewTxid}` !== previousPair) {
      this.loadDiff();
    }
    if (txidChanged && !changes.txid.firstChange) {
      setTimeout(() => { this.scrollToSelected(); });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

  // Builds a txid -> node lookup so the template can resolve the diff pair in
  // constant time instead of walking the tree on every change detection cycle
  private indexNodes(): void {
    this.nodeIndex.clear();
    const walk = (node: RbfTree): void => {
      if (!node) { return; }
      this.nodeIndex.set(node.tx.txid, node);
      node.replaces.forEach(walk);
    };
    walk(this.replacements);
  }

  // The tree always has at least one replacement edge if the root replaced anything
  private get hasReplacements(): boolean {
    return !!this.replacements?.replaces?.length;
  }

  // While a pick is in progress the previous pair's colours are dropped: leaving
  // a stale red and green on the timeline alongside the dashed anchor reads as if
  // three transactions were selected at once.
  get highlightedOldTxid(): string | null {
    return this.showDiff && !this.pendingAnchorTxid ? this.diffOldTxid : null;
  }

  get highlightedNewTxid(): string | null {
    return this.showDiff && !this.pendingAnchorTxid ? this.diffNewTxid : null;
  }

  /**
   * True when the user has picked one end of a comparison and we're waiting for
   * the other. The tables are hidden in this state so the hint is unambiguous.
   */
  get awaitingSecondPick(): boolean {
    return this.showDiff && this.pendingAnchorTxid !== null;
  }

  get pendingAnchorShort(): string {
    return this.pendingAnchorTxid ? this.pendingAnchorTxid.substring(0, 8) : '';
  }

  // Walks forward in time from `from` via replacedBy, looking for `target`
  private replacedByChainReaches(from: RbfTree, targetTxid: string): boolean {
    const seen = new Set<string>();
    let cursor: RbfTree | undefined = from;
    while (cursor?.replacedBy && !seen.has(cursor.tx.txid)) {
      seen.add(cursor.tx.txid);
      if (cursor.replacedBy.txid === targetTxid) {
        return true;
      }
      cursor = this.nodeIndex.get(cursor.replacedBy.txid);
    }
    return false;
  }

  /**
   * Works out which of two freely-picked nodes is the older one. Ancestry in the
   * replacement chain decides it; nodes on separate branches have no such
   * relationship, so those fall back to the timestamps.
   */
  private orderPair(a: RbfTree, b: RbfTree): [string, string] {
    if (this.replacedByChainReaches(a, b.tx.txid)) {
      return [a.tx.txid, b.tx.txid];
    }
    if (this.replacedByChainReaches(b, a.tx.txid)) {
      return [b.tx.txid, a.tx.txid];
    }
    return (a.time ?? 0) <= (b.time ?? 0)
      ? [a.tx.txid, b.tx.txid]
      : [b.tx.txid, a.tx.txid];
  }

  private resolveDefaultPair(force: boolean = false): void {
    // a websocket refresh shouldn't throw away whichever pair the user picked
    if (!force && this.diffOldTxid && this.diffNewTxid
        && this.nodeIndex.has(this.diffOldTxid) && this.nodeIndex.has(this.diffNewTxid)) {
      return;
    }
    this.pendingAnchorTxid = null;
    this.diffOldTxid = null;
    this.diffNewTxid = null;

    const current = (this.txid ? this.nodeIndex.get(this.txid) : null) ?? null;

    // the viewed transaction is itself a replacement: diff it against what it replaced
    if (current?.replaces.length) {
      this.diffOldTxid = current.replaces[0].tx.txid;
      this.diffNewTxid = current.tx.txid;
      return;
    }

    // the viewed transaction was replaced: keep it as the old endpoint. Using the
    // parent's first child instead would open the diff on a sibling whenever the
    // replacement swallowed several transactions at once.
    const parent = current?.replacedBy ? this.nodeIndex.get(current.replacedBy.txid) : null;
    if (current && parent) {
      this.diffOldTxid = current.tx.txid;
      this.diffNewTxid = parent.tx.txid;
      return;
    }

    // nothing selected (the replacements list): fall back to the tip of the tree
    if (this.hasReplacements) {
      this.diffOldTxid = this.replacements.replaces[0].tx.txid;
      this.diffNewTxid = this.replacements.tx.txid;
    }
  }

  /**
   * With the diff open, nodes stop being links and become comparison endpoints.
   * The first click anchors one end, the second picks the other — which is what
   * makes it possible to compare transactions that aren't next to each other.
   */
  onNodeClick(event: Event, node: RbfTree): void {
    if (!this.showDiff) {
      return;
    }
    // routerLink is already null while the diff is open, so this only has to
    // suppress the anchor's own default behaviour
    event.preventDefault();
    if (!this.pendingAnchorTxid) {
      this.pendingAnchorTxid = node.tx.txid;
      this.clearDiffResult();
      return;
    }
    if (this.pendingAnchorTxid === node.tx.txid) {
      // clicking the anchor again cancels the selection
      this.pendingAnchorTxid = null;
      this.loadDiff();
      return;
    }
    const anchor = this.nodeIndex.get(this.pendingAnchorTxid);
    this.pendingAnchorTxid = null;
    if (!anchor) {
      return;
    }
    [this.diffOldTxid, this.diffNewTxid] = this.orderPair(anchor, node);
    this.loadDiff();
  }

  /**
   * Clicking the line joining two dots compares exactly those two — the quick
   * path for the common case of two consecutive replacements.
   */
  onEdgeClick(event: Event, node: RbfTree | undefined): void {
    if (!this.showDiff || !node?.replacedBy) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.pendingAnchorTxid = null;
    this.diffOldTxid = node.tx.txid;
    this.diffNewTxid = node.replacedBy.txid;
    this.loadDiff();
  }

  private clearDiffResult(): void {
    this.diffRequest$.next(null); // drop anything still in flight
    this.diffLoading = false;
    this.diffError = false;
    this.selectedOldTx = null;
    this.selectedNewTx = null;
    this.diffView = null;
  }

  private loadDiff(): void {
    if (!this.diffOldTxid || !this.diffNewTxid) {
      return;
    }
    this.diffError = false;
    this.diffLoading = true;
    this.diffView = null;
    this.diffRequest$.next({ oldTxid: this.diffOldTxid, newTxid: this.diffNewTxid });
  }

  /**
   * Reduces the structural diff to just what the tables render. Rows for
   * unchanged fields are left out entirely rather than rendered as noise.
   */
  private buildDiffView(oldTx: Transaction, newTx: Transaction): RbfDiffView {
    const diff = calculateRbfDiff(oldTx, newTx);

    // Most important first: a replaced destination is the reason to look at all
    const outputRows: OutputDiffRow[] = [
      ...diff.outputs.modified
        .filter(m => m.changeType !== 'value')
        .map(m => ({ previous: m.old, current: m.new, addressChanged: true, feeAdjusted: false })),
      ...diff.outputs.modified
        .filter(m => m.changeType === 'value')
        .map(m => ({ previous: m.old, current: m.new, addressChanged: false, feeAdjusted: false })),
      ...diff.outputs.removed
        .map(out => ({ previous: out, current: null, addressChanged: false, feeAdjusted: false })),
      ...diff.outputs.added
        .map(out => ({ previous: null, current: out, addressChanged: false, feeAdjusted: false })),
      ...diff.outputs.feeAdjusted
        .map(adj => ({ previous: adj.old, current: adj.new, addressChanged: false, feeAdjusted: true })),
    ];

    return {
      versionChanged: diff.transaction.versionChanged,
      locktimeChanged: diff.transaction.locktimeChanged,
      feeChanged: diff.metrics.feeDelta !== null,
      feePercent: oldTx.fee > 0 ? ((newTx.fee - oldTx.fee) / oldTx.fee) * 100 : null,
      feeIncreased: newTx.fee > oldTx.fee,
      weightChanged: diff.metrics.weightDelta !== null,
      weightPercent: oldTx.weight > 0 ? ((newTx.weight - oldTx.weight) / oldTx.weight) * 100 : null,
      weightIncreased: newTx.weight > oldTx.weight,
      inputCountChanged: oldTx.vin.length !== newTx.vin.length,
      addedInputs: diff.inputs.added.length,
      removedInputs: diff.inputs.removed.length,
      outputCountChanged: oldTx.vout.length !== newTx.vout.length,
      outputRows,
    };
  }
}
