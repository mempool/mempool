import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-blockchain',
  templateUrl: './blockchain.component.html',
  styleUrls: ['./blockchain.component.scss']
})
export class BlockchainComponent implements OnInit, OnDestroy {
  @Input() position: 'middle' | 'top' = 'middle';

  txTrackingSubscription: Subscription;
  blocksSubscription: Subscription;

  txTrackingLoading = false;
  txShowTxNotFound = false;
  isLoading = true;

  constructor(
    private stateService: StateService,
  ) {}

  ngOnInit() {
    this.blocksSubscription = this.stateService.blocks$
      .pipe(
        take(1)
      )
      .subscribe((block) => this.isLoading = false);
  }

  ngOnDestroy() {
    this.blocksSubscription.unsubscribe();
  }
}
