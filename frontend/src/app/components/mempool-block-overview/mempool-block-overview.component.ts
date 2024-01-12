import { Component, ComponentRef, ViewChild, HostListener, Input, Output, EventEmitter,
  OnInit, OnDestroy, OnChanges, ChangeDetectionStrategy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { StateService } from '../../services/state.service';
import { MempoolBlockDelta, TransactionStripped } from '../../interfaces/websocket.interface';
import { BlockOverviewGraphComponent } from '../../components/block-overview-graph/block-overview-graph.component';
import { Subscription, BehaviorSubject, merge, of, timer } from 'rxjs';
import { switchMap, filter, concatMap, map } from 'rxjs/operators';
import { WebsocketService } from '../../services/websocket.service';
import { RelativeUrlPipe } from '../../shared/pipes/relative-url/relative-url.pipe';
import { Router } from '@angular/router';
import { Color } from '../block-overview-graph/sprite-types';
import TxView from '../block-overview-graph/tx-view';

@Component({
  selector: 'app-mempool-block-overview',
  templateUrl: './mempool-block-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MempoolBlockOverviewComponent implements OnInit, OnDestroy, OnChanges, AfterViewInit {
  @Input() index: number;
  @Input() showFilters: boolean = false;
  @Input() overrideColors: ((tx: TxView) => Color) | null = null;
  @Output() txPreviewEvent = new EventEmitter<TransactionStripped | void>();

  @ViewChild('blockGraph') blockGraph: BlockOverviewGraphComponent;

  lastBlockHeight: number;
  blockIndex: number;
  isLoading$ = new BehaviorSubject<boolean>(true);
  timeLtrSubscription: Subscription;
  timeLtr: boolean;
  chainDirection: string = 'right';
  poolDirection: string = 'left';

  blockSub: Subscription;
  rateLimit = 1000;
  private lastEventTime = Date.now() - this.rateLimit;
  private subId = 0;

  firstLoad: boolean = true;

  constructor(
    public stateService: StateService,
    private websocketService: WebsocketService,
    private router: Router,
    private cd: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.timeLtrSubscription = this.stateService.timeLtr.subscribe((ltr) => {
      this.timeLtr = !!ltr;
      this.chainDirection = ltr ? 'left' : 'right';
      this.poolDirection = ltr ? 'right' : 'left';
      this.cd.markForCheck();
    });
  }

  ngAfterViewInit(): void {
    this.blockSub = merge(
      this.stateService.mempoolBlockTransactions$,
      this.stateService.mempoolBlockDelta$,
    ).pipe(
      concatMap(update => {
        const now = Date.now();
        const timeSinceLastEvent = now - this.lastEventTime;
        this.lastEventTime = Math.max(now, this.lastEventTime + this.rateLimit);

        const subId = this.subId;

        // If time since last event is less than X seconds, delay this event
        if (timeSinceLastEvent < this.rateLimit) {
          return timer(this.rateLimit - timeSinceLastEvent).pipe(
            // Emit the event after the timer
            map(() => ({ update, subId }))
          );
        } else {
          // If enough time has passed, emit the event immediately
          return of({ update, subId });
        }
      })
    ).subscribe(({ update, subId }) => {
      // discard stale updates after a block transition
      if (subId !== this.subId) {
        return;
      }
      // process update
      if (update['added']) {
        // delta
        this.updateBlock(update as MempoolBlockDelta);
      } else {
        const transactionsStripped = update as TransactionStripped[];
        // new transactions
        if (this.firstLoad) {
          this.replaceBlock(transactionsStripped);
        } else {
          const inOldBlock = {};
          const inNewBlock = {};
          const added: TransactionStripped[] = [];
          const changed: { txid: string, rate: number | undefined, acc: boolean | undefined }[] = [];
          const removed: string[] = [];
          for (const tx of transactionsStripped) {
            inNewBlock[tx.txid] = true;
          }
          for (const txid of Object.keys(this.blockGraph?.scene?.txs || {})) {
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
                acc: tx.acc
              });
            }
          }
          this.updateBlock({
            removed,
            changed,
            added
          });
        }
      }
    });
  }

  ngOnChanges(changes): void {
    if (changes.index) {
      this.subId++;
      this.firstLoad = true;
      if (this.blockGraph) {
        this.blockGraph.clear(changes.index.currentValue > changes.index.previousValue ? this.chainDirection : this.poolDirection);
      }
      this.isLoading$.next(true);
      this.websocketService.startTrackMempoolBlock(changes.index.currentValue);
    }
  }

  ngOnDestroy(): void {
    this.blockSub.unsubscribe();
    this.timeLtrSubscription.unsubscribe();
    this.websocketService.stopTrackMempoolBlock();
  }

  replaceBlock(transactionsStripped: TransactionStripped[]): void {
    const blockMined = (this.stateService.latestBlockHeight > this.lastBlockHeight);
    if (this.blockIndex !== this.index) {
      const direction = (this.blockIndex == null || this.index < this.blockIndex) ? this.poolDirection : this.chainDirection;
      this.blockGraph.enter(transactionsStripped, direction);
    } else {
      this.blockGraph.replace(transactionsStripped, blockMined ? this.chainDirection : this.poolDirection);
    }

    this.lastBlockHeight = this.stateService.latestBlockHeight;
    this.blockIndex = this.index;
    this.isLoading$.next(false);
  }

  updateBlock(delta: MempoolBlockDelta): void {
    const blockMined = (this.stateService.latestBlockHeight > this.lastBlockHeight);
    if (this.blockIndex !== this.index) {
      const direction = (this.blockIndex == null || this.index < this.blockIndex) ? this.poolDirection : this.chainDirection;
      this.blockGraph.replace(delta.added, direction);
    } else {
      this.blockGraph.update(delta.added, delta.removed, delta.changed || [], blockMined ? this.chainDirection : this.poolDirection, blockMined);
    }

    this.lastBlockHeight = this.stateService.latestBlockHeight;
    this.blockIndex = this.index;
    this.isLoading$.next(false);
  }

  onTxClick(event: { tx: TransactionStripped, keyModifier: boolean }): void {
    const url = new RelativeUrlPipe(this.stateService).transform(`/tx/${event.tx.txid}`);
    if (!event.keyModifier) {
      this.router.navigate([url]);
    } else {
      window.open(url, '_blank');
    }
  }
}
