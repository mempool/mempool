import { Component, ComponentRef, ViewChild, HostListener, Input, Output, EventEmitter,
  OnDestroy, OnChanges, ChangeDetectionStrategy, AfterViewInit } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { MempoolBlockDelta, TransactionStripped } from 'src/app/interfaces/websocket.interface';
import { BlockOverviewGraphComponent } from 'src/app/components/block-overview-graph/block-overview-graph.component';
import { Subscription, BehaviorSubject, merge, of } from 'rxjs';
import { switchMap, filter } from 'rxjs/operators';
import { WebsocketService } from 'src/app/services/websocket.service';

@Component({
  selector: 'app-mempool-block-overview',
  templateUrl: './mempool-block-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MempoolBlockOverviewComponent implements OnDestroy, OnChanges, AfterViewInit {
  @Input() index: number;
  @Output() txPreviewEvent = new EventEmitter<TransactionStripped | void>();

  @ViewChild('blockGraph') blockGraph: BlockOverviewGraphComponent;

  lastBlockHeight: number;
  blockIndex: number;
  isLoading$ = new BehaviorSubject<boolean>(true);

  blockSub: Subscription;
  deltaSub: Subscription;

  constructor(
    public stateService: StateService,
    private websocketService: WebsocketService
  ) { }

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
        this.blockGraph.clear(changes.index.currentValue > changes.index.previousValue ? 'right' : 'left');
      }
      this.isLoading$.next(true);
      this.websocketService.startTrackMempoolBlock(changes.index.currentValue);
    }
  }

  ngOnDestroy(): void {
    this.blockSub.unsubscribe();
    this.deltaSub.unsubscribe();
    this.websocketService.stopTrackMempoolBlock();
  }

  replaceBlock(transactionsStripped: TransactionStripped[]): void {
    const blockMined = (this.stateService.latestBlockHeight > this.lastBlockHeight);
    if (this.blockIndex !== this.index) {
      const direction = (this.blockIndex == null || this.index < this.blockIndex) ? 'left' : 'right';
      this.blockGraph.enter(transactionsStripped, direction);
    } else {
      this.blockGraph.replace(transactionsStripped, blockMined ? 'right' : 'left');
    }

    this.lastBlockHeight = this.stateService.latestBlockHeight;
    this.blockIndex = this.index;
    this.isLoading$.next(false);
  }

  updateBlock(delta: MempoolBlockDelta): void {
    const blockMined = (this.stateService.latestBlockHeight > this.lastBlockHeight);

    if (this.blockIndex !== this.index) {
      const direction = (this.blockIndex == null || this.index < this.blockIndex) ? 'left' : 'right';
      this.blockGraph.replace(delta.added, direction);
    } else {
      this.blockGraph.update(delta.added, delta.removed, blockMined ? 'right' : 'left', blockMined);
    }

    this.lastBlockHeight = this.stateService.latestBlockHeight;
    this.blockIndex = this.index;
    this.isLoading$.next(false);
  }

  onTxPreview(event: TransactionStripped | void): void {
    this.txPreviewEvent.emit(event);
  }
}
