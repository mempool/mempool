import { Component, OnInit, OnDestroy, Renderer2 } from '@angular/core';
import { MemPoolService, ITxTracking } from '../services/mem-pool.service';
import { ApiService } from '../services/api.service';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';

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
    private memPoolService: MemPoolService,
    private apiService: ApiService,
    private renderer: Renderer2,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.apiService.webSocketWant(['stats', 'blocks', 'projected-blocks']);

    this.txTrackingSubscription = this.memPoolService.txTracking$
      .subscribe((response: ITxTracking) => {
        this.txTrackingLoading = false;
        this.txShowTxNotFound = response.notFound;
        if (this.txShowTxNotFound) {
          setTimeout(() => { this.txShowTxNotFound = false; }, 2000);
        }
      });

    this.renderer.addClass(document.body, 'disable-scroll');

    this.route.paramMap
      .subscribe((params: ParamMap) => {
        const txId: string | null = params.get('id');
        if (!txId) {
          return;
        }
        this.txTrackingLoading = true;
        this.apiService.webSocketStartTrackTx(txId);
      });

    this.memPoolService.txIdSearch$
      .subscribe((txId) => {
        if (txId) {
          this.txTrackingLoading = true;
          this.apiService.webSocketStartTrackTx(txId);
        }
      });

    this.blocksSubscription = this.memPoolService.blocks$
      .pipe(
        take(1)
      )
      .subscribe((block) => this.isLoading = false);
  }

  ngOnDestroy() {
    this.blocksSubscription.unsubscribe();
    this.txTrackingSubscription.unsubscribe();
    this.renderer.removeClass(document.body, 'disable-scroll');
  }
}
