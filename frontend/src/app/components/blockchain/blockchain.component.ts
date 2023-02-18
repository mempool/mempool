import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-blockchain',
  templateUrl: './blockchain.component.html',
  styleUrls: ['./blockchain.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockchainComponent implements OnInit, OnDestroy {
  @Input() pages: any[] = [];
  @Input() pageIndex: number;
  @Input() blocksPerPage: number = 8;
  @Input() minScrollWidth: number = 0;

  network: string;
  timeLtrSubscription: Subscription;
  timeLtr: boolean = this.stateService.timeLtr.value;
  ltrTransitionEnabled = false;

  constructor(
    public stateService: StateService,
  ) {}

  ngOnInit() {
    this.network = this.stateService.network;
    this.timeLtrSubscription = this.stateService.timeLtr.subscribe((ltr) => {
      this.timeLtr = !!ltr;
    });
  }

  ngOnDestroy() {
    this.timeLtrSubscription.unsubscribe();
  }

  trackByPageFn(index: number, item: { index: number }) {
    return item.index;
  }

  toggleTimeDirection() {
    this.ltrTransitionEnabled = true;
    this.stateService.timeLtr.next(!this.timeLtr);
  }
}
