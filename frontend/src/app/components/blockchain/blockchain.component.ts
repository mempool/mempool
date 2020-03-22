import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-blockchain',
  templateUrl: './blockchain.component.html',
  styleUrls: ['./blockchain.component.scss']
})
export class BlockchainComponent implements OnInit, OnDestroy {
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
      .subscribe(() => this.isLoading = false);
  }

  ngOnDestroy() {
    this.blocksSubscription.unsubscribe();
  }
}
