import { Component, OnInit, OnDestroy } from '@angular/core';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { Transaction, Block } from '../../interfaces/electrs.interface';
import { of } from 'rxjs';
import { StateService } from '../../services/state.service';
import { WebsocketService } from '../../services/websocket.service';
import { AudioService } from 'src/app/services/audio.service';
import { ApiService } from 'src/app/services/api.service';

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
  transactionTime = -1;

  rightPosition = 0;
  blockDepth = 0;

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
    private stateService: StateService,
    private websocketService: WebsocketService,
    private audioService: AudioService,
    private apiService: ApiService,
  ) { }

  ngOnInit() {
    this.websocketService.want(['blocks', 'stats', 'mempool-blocks']);

    this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        this.txId = params.get('id') || '';
        this.error = undefined;
        this.isLoadingTx = true;
        document.body.scrollTo(0, 0);
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

      if (!tx.status.confirmed) {
        this.websocketService.startTrackTransaction(tx.txid);
      }

      this.getTransactionTime();
    },
    (error) => {
      this.error = error;
      this.isLoadingTx = false;
    });

    this.stateService.conversions$
      .subscribe((conversions) => this.conversions = conversions);

    this.stateService.blocks$
      .subscribe((block) => this.latestBlock = block);

    this.stateService.txConfirmed$
      .subscribe((block) => {
        this.tx.status = {
          confirmed: true,
          block_height: block.height,
          block_hash: block.id,
          block_time: block.timestamp,
        };
        this.audioService.playSound('magic');
      });
  }

  getTransactionTime() {
    this.apiService.getTransactionTimes$([this.tx.txid])
      .subscribe((transactionTimes) => {
        this.transactionTime = transactionTimes[0];
      });
  }

  ngOnDestroy() {
    this.websocketService.startTrackTransaction('stop');
  }
}
