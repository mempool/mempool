import { Component, OnInit, ChangeDetectionStrategy, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { StateService } from '../../../services/state.service';
import { WebsocketService } from '../../../services/websocket.service';
import { map, Observable } from 'rxjs';
import { StratumJob } from '../../../interfaces/websocket.interface';
import { MiningService } from '../../../services/mining.service';
import { SinglePoolStats } from '../../../interfaces/node-api.interface';

type MerkleCellType = ' ' | '┬' | '├' | '└' | '│' | '─' | 'leaf';


interface TaggedStratumJob extends StratumJob {
  tag: string;
  merkleBranchIds: string[];
}

interface MerkleCell {
  hash: string;
  type: MerkleCellType;
  job?: TaggedStratumJob;
}

interface MerkleTree {
  hash?: string;
  job: string;
  size: number;
  children?: MerkleTree[];
}

interface PoolRow {
  job: TaggedStratumJob;
  merkleCells: MerkleCell[];
}

function parseTag(scriptSig: string): string {
  const hex = scriptSig.slice(8).replace(/6d6d.{64}/, '');
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  // eslint-disable-next-line no-control-regex
  const ascii = new TextDecoder('utf8').decode(Uint8Array.from(bytes)).replace(/\uFFFD/g, '').replace(/\\0/g, '').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  if (ascii.includes('/ViaBTC/')) {
    return '/ViaBTC/';
  } else if (ascii.includes('SpiderPool/')) {
    return 'SpiderPool/';
  }
  return (ascii.match(/\/.*\//)?.[0] || ascii).trim();
}

function getMerkleBranchIds(merkleBranches: string[], numBranches: number, poolId: number): string[] {
  let lastHash = '';
  const ids: string[] = [];
  for (let i = 0; i < numBranches; i++) {
    if (merkleBranches[i]) {
      lastHash = merkleBranches[i];
      ids.push(`${i}-${lastHash}`);
    } else {
      ids.push(`${i}-${lastHash}-${poolId}`);
    }
  }
  return ids;
}

@Component({
  selector: 'app-stratum-list',
  templateUrl: './stratum-list.component.html',
  styleUrls: ['./stratum-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StratumList implements OnInit, OnDestroy {
  rows$: Observable<PoolRow[]>;
  pools: { [id: number]: SinglePoolStats } = {};
  poolsReady: boolean = false;

  constructor(
    private stateService: StateService,
    private websocketService: WebsocketService,
    private miningService: MiningService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.websocketService.want(['stats', 'blocks', 'mempool-blocks']);
    this.miningService.getPools().subscribe(pools => {
      this.pools = {};
      for (const pool of pools) {
        this.pools[pool.unique_id] = pool;
      }
      this.poolsReady = true;
      this.cd.markForCheck();
    });
    this.rows$ = this.stateService.stratumJobs$.pipe(
      map((jobs) => this.processJobs(jobs)),
    );
    this.websocketService.startTrackStratum('all');
  }

  processJobs(rawJobs: Record<string, StratumJob>): PoolRow[] {
    const numBranches = Math.max(...Object.values(rawJobs).map(job => job.merkleBranches.length));
    const jobs: Record<string, TaggedStratumJob> = {};
    for (const [id, job] of Object.entries(rawJobs)) {
      jobs[id] = { ...job, tag: parseTag(job.scriptsig), merkleBranchIds: getMerkleBranchIds(job.merkleBranches, numBranches, job.pool) };
    }
    if (Object.keys(jobs).length === 0) {
      return [];
    }

    let trees: MerkleTree[] = Object.keys(jobs).map(job => ({
      job,
      size: 1,
    }));

    // build tree from bottom up
    for (let col = numBranches - 1; col >= 0; col--) {
      const groups: Record<string, MerkleTree[]> = {};
      for (const tree of trees) {
        const branchId = jobs[tree.job].merkleBranchIds[col];
        if (!groups[branchId]) {
          groups[branchId] = [];
        }
        groups[branchId].push(tree);
      }

      trees = Object.values(groups).map(group => ({
        hash: jobs[group[0].job].merkleBranches[col],
        job: group[0].job,
        children: group,
        size: group.reduce((acc, tree) => acc + tree.size, 0),
      }));
    }

    // initialize grid of cells
    const rows: (MerkleCell | null)[][] = [];
    for (let i = 0; i < Object.keys(jobs).length; i++) {
      const row: (MerkleCell | null)[] = [];
      for (let j = 0; j <= numBranches; j++) {
        row.push(null);
      }
      rows.push(row);
    }

    // fill in the cells
    let colTrees = [trees.sort((a, b) => {
      if (a.size !== b.size) {
        return b.size - a.size;
      }
      return a.job.localeCompare(b.job);
    })];
    for (let col = 0; col <= numBranches; col++) {
      let row = 0;
      const nextTrees: MerkleTree[][] = [];
      for (let g = 0; g < colTrees.length; g++) {
        for (let t = 0; t < colTrees[g].length; t++) {
          const tree = colTrees[g][t];
          const isFirstTree = (t === 0);
          const isLastTree = (t === colTrees[g].length - 1);
          for (let i = 0; i < tree.size; i++) {
            const isFirstCell = (i === 0);
            const isLeaf = (col === numBranches);
            rows[row][col] = {
              hash: tree.hash,
              job: isLeaf ? jobs[tree.job] : undefined,
              type: 'leaf',
            };
            if (col > 0) {
              rows[row][col - 1].type = getCellType(isFirstCell, isFirstTree, isLastTree);
            }
            row++;
          }
          if (tree.children) {
            nextTrees.push(tree.children.sort((a, b) => {
              if (a.size !== b.size) {
                return b.size - a.size;
              }
              return a.job.localeCompare(b.job);
            }));
          }
        }
      }
      colTrees = nextTrees;
    }
    return rows.map(row => ({
      job: row[row.length - 1].job,
      merkleCells: row.slice(0, -1),
    }));
  }

  pipeToClass(type: MerkleCellType): string {
    return {
      ' ': 'empty',
      '┬': 'branch-top',
      '├': 'branch-mid',
      '└': 'branch-end',
      '│': 'vertical',
      '─': 'horizontal',
      'leaf': 'leaf'
    }[type];
  }

  reverseHash(hash: string) {
    return hash.match(/../g).reverse().join('');
  }

  ngOnDestroy(): void {
    this.websocketService.stopTrackStratum();
  }
}

function getCellType(isFirstCell, isFirstTree, isLastTree): MerkleCellType {
  if (isFirstCell) {
    if (isFirstTree) {
      if (isLastTree) {
        return '─';
      } else {
        return '┬';
      }
    } else if (isLastTree) {
      return '└';
    } else {
      return '├';
    }
  } else {
    if (isLastTree) {
      return ' ';
    } else {
      return '│';
    }
  }
}
