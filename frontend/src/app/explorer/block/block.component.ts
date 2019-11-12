import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { ApiService } from 'src/app/services/api.service';
import { MemPoolService } from 'src/app/services/mem-pool.service';
import { switchMap } from 'rxjs/operators';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-block',
  templateUrl: './block.component.html',
  styleUrls: ['./block.component.scss']
})
export class BlockComponent implements OnInit {
  block: any;
  isLoadingBlock = true;
  latestBlockHeight: number;
  transactions: any[];
  isLoadingTransactions = true;

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private memPoolService: MemPoolService,
    private ref: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        this.isLoadingBlock = true;
        const blockHash: string = params.get('id') || '';
        this.getBlockTransactions(blockHash);
        return this.apiService.getBlock$(blockHash);
      })
    )
    .subscribe((block) => {
      this.block = block;
      this.isLoadingBlock = false;
      this.ref.markForCheck();
    });

    this.memPoolService.blocks$
      .subscribe((block) => {
        this.latestBlockHeight = block.height;
      });
  }

  getBlockTransactions(hash: string) {
    this.apiService.getBlockTransactions$(hash)
      .subscribe((transactions: any) => {
        this.transactions = transactions;
        this.isLoadingTransactions = false;
      });
  }

  loadMore() {
    this.isLoadingTransactions = true;
    this.apiService.getBlockTransactions$(this.block.id, this.transactions.length)
      .subscribe((transactions) => {
        this.transactions = this.transactions.concat(transactions);
        this.isLoadingTransactions = false;
      });
  }

}
