import { Component, Input, OnInit, OnChanges, Inject, LOCALE_ID, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { RbfInfo, RbfTree } from '../../interfaces/node-api.interface';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';

type Connector = 'pipe' | 'corner';

interface TimelineCell {
  replacement?: RbfInfo,
  connector?: Connector,
  first?: boolean,
}

@Component({
  selector: 'app-rbf-timeline',
  templateUrl: './rbf-timeline.component.html',
  styleUrls: ['./rbf-timeline.component.scss'],
})
export class RbfTimelineComponent implements OnInit, OnChanges {
  @Input() replacements: RbfTree;
  @Input() txid: string;
  rows: TimelineCell[][] = [];

  hoverInfo: RbfInfo | void = null;
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
    if (changes.txid) {
      setTimeout(() => { this.scrollToSelected(); });
    }
  }

  // converts a tree of RBF events into a format that can be more easily rendered in HTML
  buildTimelines(tree: RbfTree): TimelineCell[][] {
    if (!tree) return [];

    const split = this.splitTimelines(tree);
    const timelines = this.prepareTimelines(split);
    return this.connectTimelines(timelines);
  }

  // splits a tree into N leaf-to-root paths
  splitTimelines(tree: RbfTree, tail: RbfInfo[] = []): RbfInfo[][] {
    const replacements = [...tail, tree];
    if (tree.replaces.length) {
      return [].concat(...tree.replaces.map(subtree => this.splitTimelines(subtree, replacements)));
    } else {
      return [[...replacements]];
    }
  }

  // merges separate leaf-to-root paths into a coherent forking timeline
  // represented as a 2D array of Rbf events
  prepareTimelines(lines: RbfInfo[][]): RbfInfo[][] {
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
        const toMerge: { [txid: string]: RbfInfo[][] } = {};
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
            rows[index].unshift(null);
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
  connectTimelines(timelines: RbfInfo[][]): TimelineCell[][] {
    const rows: TimelineCell[][] = [];
    timelines.forEach((lines, row) => {
      rows.push([]);
      let started = false;
      let finished = false;
      lines.forEach((replacement, column) => {
        const cell: TimelineCell = {};
        if (replacement) {
          cell.replacement = replacement;
        }
        rows[row].push(cell);
        if (replacement) {
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
                  connector: 'corner'
                };
              } else if (nextCell.connector !== 'corner') {
                rows[i][column] = {
                  connector: 'pipe'
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
