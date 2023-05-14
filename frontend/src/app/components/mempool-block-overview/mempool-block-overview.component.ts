import { Component, ComponentRef, ViewChild, HostListener, Input, Output, EventEmitter,
  OnInit, OnDestroy, OnChanges, ChangeDetectionStrategy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { StateService } from '../../services/state.service';
import { MempoolBlockDelta, TransactionStripped } from '../../interfaces/websocket.interface';
import { BlockOverviewGraphComponent } from '../../components/block-overview-graph/block-overview-graph.component';
import { Subscription, BehaviorSubject, merge, of } from 'rxjs';
import { switchMap, filter } from 'rxjs/operators';
import { WebsocketService } from '../../services/websocket.service';
import { RelativeUrlPipe } from '../../shared/pipes/relative-url/relative-url.pipe';
import { Router } from '@angular/router';

@Component({
  selector: 'app-mempool-block-overview',
  templateUrl: './mempool-block-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MempoolBlockOverviewComponent implements OnInit, OnDestroy, OnChanges, AfterViewInit {
  @Input() index: number;
  @Input() pixelAlign: boolean = false;
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
  deltaSub: Subscription;

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
        of(true),
        this.stateService.connectionState$.pipe(filter((state) => state === 2))
      )
      .pipe(switchMap(() => this.stateService.mempoolBlockTransactions$))
      .subscribe((transactionsStripped) => {
        this.replaceBlock(transactionsStripped);
      });
    this.deltaSub = this.stateService.mempoolBlockDelta$.subscribe((delta) => {
      this.updateBlock(delta);
    });
  }

  ngOnChanges(changes): void {
    if (changes.index) {
      if (this.blockGraph) {
        this.blockGraph.clear(changes.index.currentValue > changes.index.previousValue ? this.chainDirection : this.poolDirection);
      }
      this.isLoading$.next(true);
      this.websocketService.startTrackMempoolBlock(changes.index.currentValue);
    }
  }

  ngOnDestroy(): void {
    this.blockSub.unsubscribe();
    this.deltaSub.unsubscribe();
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
