import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { Subject, Subscription, of } from 'rxjs';
import { StateService } from '../../services/state.service';
import { WebsocketService } from '../../services/websocket.service';
import { BlockExtended, TransactionStripped } from '../../interfaces/node-api.interface';
import { ApiService } from '../../services/api.service';
import { detectWebGL } from '../../shared/graphs.utils';
import { animate, style, transition, trigger } from '@angular/animations';
import { BytesPipe } from '../../shared/pipes/bytes-pipe/bytes.pipe';
import { BlockOverviewMultiComponent } from '../block-overview-multi/block-overview-multi.component';
import { CacheService } from '../../services/cache.service';
import { isMempoolDelta, MempoolBlockDelta } from '../../interfaces/websocket.interface';

function bestFitResolution(min, max, n): number {
  const target = (min + max) / 2;
  let bestScore = Infinity;
  let best = null;
  for (let i = min; i <= max; i++) {
    const remainder = (n % i);
    if (remainder < bestScore || (remainder === bestScore && (Math.abs(i - target) < Math.abs(best - target)))) {
      bestScore = remainder;
      best = i;
    }
  }
  return best;
}

interface BlockInfo extends BlockExtended {
  timeString: string;
}

@Component({
  selector: 'app-eight-mempool',
  templateUrl: './eight-mempool.component.html',
  styleUrls: ['./eight-mempool.component.scss'],
  animations: [
    trigger('infoChange', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('1000ms', style({ opacity: 1 })),
      ]),
      transition(':leave', [
        animate('1000ms 500ms', style({ opacity: 0 }))
      ])
    ]),
  ],
})
export class EightMempoolComponent implements OnInit, OnDestroy {
  network = '';
  strippedTransactions: { [height: number]: TransactionStripped[] } = {};
  webGlEnabled = true;
  hoverTx: string | null = null;

  tipSubscription: Subscription;
  networkChangedSubscription: Subscription;
  queryParamsSubscription: Subscription;
  graphChangeSubscription: Subscription;
  blockSub: Subscription;

  chainDirection: string = 'right';
  poolDirection: string = 'left';

  lastBlockHeight: number = 0;
  lastBlockHeightUpdate: number[] = [];
  numBlocks: number = 8;
  blockIndices: number[] = [];
  autofit: boolean = false;
  padding: number = 0;
  wrapBlocks: boolean = false;
  blockWidth: number = 360;
  animationDuration: number = 2000;
  animationOffset: number = 0;
  stagger: number = 0;
  testing: boolean = true;
  testHeight: number = 800000;
  testShiftTimeout: number;

  showInfo: boolean = true;
  blockInfo: BlockInfo[] = [];

  wrapperStyle = {
    '--block-width': '1080px',
    width: '1080px',
    maxWidth: '1080px',
    padding: '',
  };
  containerStyle = {};
  resolution: number = 86;

  @ViewChild('blockGraph') blockGraph: BlockOverviewMultiComponent;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public stateService: StateService,
    private websocketService: WebsocketService,
    private apiService: ApiService,
    private cacheService: CacheService,
    private bytesPipe: BytesPipe,
  ) {
    this.webGlEnabled = this.stateService.isBrowser && detectWebGL();
  }

  ngOnInit(): void {
    this.websocketService.want(['blocks']);
    this.network = this.stateService.network;

    this.blockSub = this.stateService.mempoolBlockUpdate$.subscribe((update) => {
      // process update
      if (isMempoolDelta(update)) {
        // delta
        this.updateBlock(update);
      } else {
        const transactionsStripped = update.transactions;
        const inOldBlock = {};
        const inNewBlock = {};
        const added: TransactionStripped[] = [];
        const changed: { txid: string, rate: number | undefined, flags: number, acc: boolean | undefined }[] = [];
        const removed: string[] = [];
        for (const tx of transactionsStripped) {
          inNewBlock[tx.txid] = true;
        }
        for (const txid of Object.keys(this.blockGraph?.scenes[update.block]?.txs || {})) {
          inOldBlock[txid] = true;
          if (!inNewBlock[txid]) {
            removed.push(txid);
          }
        }
        for (const tx of transactionsStripped) {
          if (!inOldBlock[tx.txid]) {
            added.push(tx);
          } else {
            changed.push({
              txid: tx.txid,
              rate: tx.rate,
              flags: tx.flags,
              acc: tx.acc
            });
          }
        }
        this.updateBlock({
          block: update.block,
          removed,
          changed,
          added
        });
      }
    });

    this.queryParamsSubscription = this.route.queryParams.subscribe((params) => {
      this.numBlocks = Number.isInteger(Number(params.numBlocks)) ? Number(params.numBlocks) : 8;
      this.blockIndices = [...Array(this.numBlocks).keys()];
      this.lastBlockHeightUpdate = this.blockIndices.map(() => 0);
      this.autofit = params.autofit !== 'false';
      this.blockWidth = Number.isInteger(Number(params.blockWidth)) ? Number(params.blockWidth) : 540;
      this.padding = Number.isInteger(Number(params.padding)) ? Number(params.padding) : this.blockWidth;
      this.wrapBlocks = params.wrap !== 'false';
      this.stagger = Number.isInteger(Number(params.stagger)) ? Number(params.stagger) : 0;
      this.animationDuration = Number.isInteger(Number(params.animationDuration)) ? Number(params.animationDuration) : 2000;
      this.animationOffset = 0;

      if (this.autofit) {
        this.resolution = bestFitResolution(76, 96, this.blockWidth - this.padding * 2);
      } else {
        this.resolution = 86;
      }

      this.wrapperStyle = {
        '--block-width': this.blockWidth + 'px',
        width: this.blockWidth + 'px',
        maxWidth: this.blockWidth + 'px',
        padding: (this.padding || 0) +'px 0px',
      };

      this.websocketService.startTrackMempoolBlocks(this.blockIndices);
    });

    this.networkChangedSubscription = this.stateService.networkChanged$
      .subscribe((network) => this.network = network);
  }

  ngOnDestroy(): void {
    this.stateService.markBlock$.next({});
    this.tipSubscription.unsubscribe();
    this.networkChangedSubscription?.unsubscribe();
    this.queryParamsSubscription?.unsubscribe();
  }

  updateBlock(delta: MempoolBlockDelta): void {
    const blockMined = (this.stateService.latestBlockHeight > this.lastBlockHeightUpdate[delta.block]);
    if (blockMined) {
      this.blockGraph.update(this.numBlocks - delta.block - 1, delta.added, delta.removed, delta.changed || [], blockMined ? this.chainDirection : this.poolDirection, blockMined);
    } else {
      this.blockGraph.update(this.numBlocks - delta.block - 1, delta.added, delta.removed, delta.changed || [], this.poolDirection);
    }

    this.lastBlockHeightUpdate[delta.block] = this.stateService.latestBlockHeight;
  }
}
