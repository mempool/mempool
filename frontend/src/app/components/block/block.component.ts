import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { switchMap } from 'rxjs/operators';
import { Block, Transaction } from '../../interfaces/electrs.interface';
import { of } from 'rxjs';
import { StateService } from '../../services/state.service';
import { WebsocketService } from 'src/app/services/websocket.service';

@Component({
  selector: 'app-block',
  templateUrl: './block.component.html',
  styleUrls: ['./block.component.scss']
})
export class BlockComponent implements OnInit {
  block: Block;
  blockHeight: number;
  blockHash: string;
  isLoadingBlock = true;
  latestBlock: Block;
  transactions: Transaction[];
  isLoadingTransactions = true;
  error: any;
  blockSubsidy = 50;

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
    private stateService: StateService,
    private websocketService: WebsocketService,
  ) { }

  ngOnInit() {
    this.websocketService.want(['blocks', 'stats', 'mempool-blocks']);

    this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        const blockHash: string = params.get('id') || '';
        this.error = undefined;

        if (history.state.data && history.state.data.blockHeight) {
          this.blockHeight = history.state.data.blockHeight;
        }

        this.blockHash = blockHash;
        document.body.scrollTo(0, 0);

        if (history.state.data && history.state.data.block) {
          this.blockHeight = history.state.data.block.height;
          return of(history.state.data.block);
        } else {
          this.isLoadingBlock = true;
          return this.electrsApiService.getBlock$(blockHash);
        }
      })
    )
    .subscribe((block: Block) => {
      this.block = block;
      this.blockHeight = block.height;
      this.isLoadingBlock = false;
      this.setBlockSubsidy();
      this.getBlockTransactions(block.id);
    },
    (error) => {
      this.error = error;
      this.isLoadingBlock = false;
    });

    this.stateService.blocks$
      .subscribe((block) => this.latestBlock = block);
  }

  setBlockSubsidy() {
    let halvenings = Math.floor(this.block.height / 210000);
    while (halvenings > 0) {
      this.blockSubsidy = this.blockSubsidy / 2;
      halvenings--;
    }
  }

  getBlockTransactions(hash: string) {
    this.isLoadingTransactions = true;
    this.transactions = null;
    this.electrsApiService.getBlockTransactions$(hash)
      .subscribe((transactions: any) => {
        this.transactions = transactions;
        this.isLoadingTransactions = false;
      });
  }

  loadMore() {
    if (this.isLoadingTransactions || !this.transactions.length || this.transactions.length === this.block.tx_count) {
      return;
    }

    this.isLoadingTransactions = true;
    this.electrsApiService.getBlockTransactions$(this.block.id, this.transactions.length)
      .subscribe((transactions) => {
        this.transactions = this.transactions.concat(transactions);
        this.isLoadingTransactions = false;
      });
  }

}
