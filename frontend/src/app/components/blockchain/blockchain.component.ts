import { Component, OnInit, OnDestroy, Renderer2 } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { WebsocketService } from 'src/app/services/websocket.service';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-blockchain',
  templateUrl: './blockchain.component.html',
  styleUrls: ['./blockchain.component.scss']
})
export class BlockchainComponent implements OnInit, OnDestroy {
  txTrackingSubscription: Subscription;
  blocksSubscription: Subscription;

  txTrackingLoading = false;
  txShowTxNotFound = false;
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private websocketService: WebsocketService,
    private stateService: StateService,
  ) {}

  ngOnInit() {
    /*
    this.apiService.webSocketWant(['stats', 'blocks', 'mempool-blocks']);

    this.txTrackingSubscription = this.memPoolService.txTracking$
      .subscribe((response: ITxTracking) => {
        this.txTrackingLoading = false;
        this.txShowTxNotFound = response.notFound;
        if (this.txShowTxNotFound) {
          setTimeout(() => { this.txShowTxNotFound = false; }, 2000);
        }
      });
    */

    /*
    this.route.paramMap
      .subscribe((params: ParamMap) => {
        if (this.memPoolService.txTracking$.value.enabled) {
          return;
        }

        const txId: string | null = params.get('id');
        if (!txId) {
          return;
        }
        this.txTrackingLoading = true;
        this.apiService.webSocketStartTrackTx(txId);
      });

      */

    /*
    this.memPoolService.txIdSearch$
      .subscribe((txId) => {
        if (txId) {

          if (this.memPoolService.txTracking$.value.enabled
            && this.memPoolService.txTracking$.value.tx
            && this.memPoolService.txTracking$.value.tx.txid === txId) {
            return;
          }
          console.log('enabling tracking loading from idSearch!');
          this.txTrackingLoading = true;
          this.websocketService.startTrackTx(txId);
        }
      });
      */

    this.blocksSubscription = this.stateService.blocks$
      .pipe(
        take(1)
      )
      .subscribe((block) => this.isLoading = false);
  }

  ngOnDestroy() {
    this.blocksSubscription.unsubscribe();
    // this.txTrackingSubscription.unsubscribe();
  }
}
