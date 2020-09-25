import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { combineLatest, merge, Observable, of } from 'rxjs';
import { map, reduce, scan, tap } from 'rxjs/operators';
import { Block } from '../interfaces/electrs.interface';
import { MempoolInfo, TransactionStripped } from '../interfaces/websocket.interface';
import { StateService } from '../services/state.service';

interface MempoolBlocksData {
  blocks: number;
  size: number;
}

interface EpochProgress {
  base: string;
  green: string;
  red: string;
  change: number;
}

interface MempoolInfoData {
  memPoolInfo: MempoolInfo;
  vBytesPerSecond: number;
  progressWidth: string;
  progressClass: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  network$: Observable<string>;
  mempoolBlocksData$: Observable<MempoolBlocksData>;
  mempoolInfoData$: Observable<MempoolInfoData>;
  difficultyEpoch$: Observable<EpochProgress>;
  vBytesPerSecondLimit = 1667;
  blocks$: Observable<Block[]>;
  transactions$: Observable<TransactionStripped[]>;
  latestBlockHeight: number;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit(): void {
    this.network$ = merge(of(''), this.stateService.networkChanged$);

    this.mempoolInfoData$ = combineLatest([
      this.stateService.mempoolInfo$,
      this.stateService.vbytesPerSecond$
    ])
    .pipe(
      map(([mempoolInfo, vbytesPerSecond]) => {
        const percent = Math.round((Math.min(vbytesPerSecond, this.vBytesPerSecondLimit) / this.vBytesPerSecondLimit) * 100);

        let progressClass = 'bg-danger';
        if (percent <= 75) {
          progressClass = 'bg-success';
        } else if (percent <= 99) {
          progressClass = 'bg-warning';
        }

        return {
          memPoolInfo: mempoolInfo,
          vBytesPerSecond: vbytesPerSecond,
          progressWidth: percent + '%',
          progressClass: progressClass,
        };
      })
    );

    this.difficultyEpoch$ = combineLatest([
      this.stateService.blocks$.pipe(map(([block]) => block)),
      this.stateService.lastDifficultyAdjustment$
    ])
    .pipe(
      map(([block, DATime]) => {
        const now = new Date().getTime() / 1000;
        const diff = now - DATime;
        const blocksInEpoch = block.height % 2016;
        const estimatedBlocks = Math.round(diff / 60 / 10);
        const difficultyChange = (blocksInEpoch - (diff / 60 / 10)) / blocksInEpoch * 100;

        let base = 0;
        let green = 0;
        let red = 0;

        if (blocksInEpoch >= estimatedBlocks) {
          base = estimatedBlocks / 2016 * 100;
          green = (blocksInEpoch - estimatedBlocks) / 2016 * 100;
        } else {
          base = blocksInEpoch / 2016 * 100;
          red = (estimatedBlocks - blocksInEpoch) / 2016 * 100;
        }

        return {
          base: base + '%',
          green: green + '%',
          red: red + '%',
          change: difficultyChange,
        };
      })
    );

    this.mempoolBlocksData$ = this.stateService.mempoolBlocks$
      .pipe(
        map((mempoolBlocks) => {
          const size = mempoolBlocks.map((m) => m.blockSize).reduce((a, b) => a + b, 0);
          const vsize = mempoolBlocks.map((m) => m.blockVSize).reduce((a, b) => a + b, 0);

          return {
            size: size,
            blocks: Math.ceil(vsize / 1000000)
          };
        })
      );

    this.blocks$ = this.stateService.blocks$
      .pipe(
        tap(([block]) => {
          this.latestBlockHeight = block.height;
        }),
        scan((acc, [block]) => {
          acc.unshift(block);
          return acc;
        }, []),
        map((blocks) => blocks.slice(0, 6)),
      );

    this.transactions$ = this.stateService.transactions$
      .pipe(
        scan((acc, tx) => {
          acc.unshift(tx);
          return acc;
        }, []),
        map((txs) => txs.slice(0, 6)),
      );
  }

  trackByBlock(index: number, block: Block) {
    return block.height;
  }
}
