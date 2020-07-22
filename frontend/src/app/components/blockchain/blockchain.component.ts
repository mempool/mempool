import { Component, OnInit, OnDestroy } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-blockchain',
  templateUrl: './blockchain.component.html',
  styleUrls: ['./blockchain.component.scss']
})
export class BlockchainComponent implements OnInit, OnDestroy {
  txTrackingLoading = false;
  txShowTxNotFound = false;
  isLoading = true;
  subscription: Subscription;

  constructor(
    private stateService: StateService,
  ) {}

  ngOnInit() {
    this.subscription = this.stateService.isLoadingWebSocket$
      .subscribe((isLoading) => this.isLoading = isLoading);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
