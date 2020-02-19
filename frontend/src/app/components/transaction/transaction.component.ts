import { Component, OnInit, OnDestroy } from '@angular/core';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { Transaction, Block } from '../../interfaces/electrs.interface';
import { of } from 'rxjs';
import { StateService } from '../../services/state.service';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-transaction',
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.scss']
})
export class TransactionComponent implements OnInit, OnDestroy {
  tx: Transaction;
  txId: string;
  isLoadingTx = true;
  conversions: any;
  error: any = undefined;
  latestBlock: Block;

  rightPosition = 0;
  blockDepth = 0;

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
    private stateService: StateService,
    private websocketService: WebsocketService,
  ) { }

  ngOnInit() {
    this.websocketService.want(['blocks', 'mempool-blocks']);

    this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        this.txId = params.get('id') || '';
        this.error = undefined;
        this.isLoadingTx = true;
        if (history.state.data) {
          return of(history.state.data);
        } else {
          return this.electrsApiService.getTransaction$(this.txId);
        }
      })
    )
    .subscribe((tx: Transaction) => {
      this.tx = tx;
      this.isLoadingTx = false;
      window.scrollTo(0, 0);

      if (!tx.status.confirmed) {
        this.websocketService.startTrackTransaction(tx.txid);
      }
    },
    (error) => {
      this.error = error;
      this.isLoadingTx = false;
    });

    this.stateService.conversions$
      .subscribe((conversions) => this.conversions = conversions);

    this.stateService.blocks$
      .subscribe((block) => this.latestBlock = block);

    this.stateService.txConfirmed
      .subscribe((block) => {
        this.tx.status = {
          confirmed: true,
          block_height: block.height,
          block_hash: block.id,
          block_time: block.timestamp,
        };
      });
  }

  ngOnDestroy() {
    this.websocketService.startTrackTransaction('stop');
  }
}
