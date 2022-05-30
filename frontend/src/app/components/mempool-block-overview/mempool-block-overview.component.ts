import { Component, Input, OnInit, OnDestroy,  OnChanges, ChangeDetectionStrategy } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { MempoolBlockWithTransactions } from 'src/app/interfaces/websocket.interface';
import { Observable, Subscription } from 'rxjs';
import { WebsocketService } from 'src/app/services/websocket.service';

@Component({
  selector: 'app-mempool-block-overview',
  templateUrl: './mempool-block-overview.component.html',
  styleUrls: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MempoolBlockOverviewComponent implements OnInit, OnDestroy, OnChanges {
  @Input() index: number;

  sub: Subscription;
  mempoolBlock$: Observable<MempoolBlockWithTransactions>;

  constructor(
    public stateService: StateService,
    private websocketService: WebsocketService,
  ) { }

  ngOnInit(): void {
    this.websocketService.startTrackMempoolBlock(this.index);
    this.mempoolBlock$ = this.stateService.mempoolBlock$
    this.sub = this.mempoolBlock$.subscribe((block) => {
      this.updateBlock(block)
    })
  }

  ngOnChanges(changes): void {
    if (changes.index) {
      this.websocketService.startTrackMempoolBlock(changes.index.currentValue);
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.websocketService.stopTrackMempoolBlock();
  }

  updateBlock(block: MempoolBlockWithTransactions): void {
    
  }
}
