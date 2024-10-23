import { Component, Input, OnInit, OnChanges, Inject, LOCALE_ID, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { RbfTree, RbfTransaction } from '@interfaces/node-api.interface';
import { StateService } from '@app/services/state.service';
import { ApiService } from '@app/services/api.service';

type Connector = 'pipe' | 'corner';

interface TimelineCell {
  replacement?: RbfTree,
  connector?: Connector,
  first?: boolean,
  fullRbf?: boolean,
}

function isTimelineCell(val: RbfTree | TimelineCell): boolean {
  return !val || !('tx' in val);
}

@Component({
  selector: 'app-rbf-timeline',
  templateUrl: './rbf-timeline.component.html',
  styleUrls: ['./rbf-timeline.component.scss'],
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
    if (!tree) return [];

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
}
