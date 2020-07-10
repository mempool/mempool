import { Component, OnInit } from '@angular/core';
import { BisqTransaction } from 'src/app/interfaces/bisq.interfaces';
import { ApiService } from 'src/app/services/api.service';

@Component({
  selector: 'app-bisq-block',
  templateUrl: './bisq-block.component.html',
  styleUrls: ['./bisq-block.component.scss']
})
export class BisqBlockComponent implements OnInit {
  bisqTransactions: BisqTransaction[];
  bisqTransactionsCount: number;

  blockHash = '';
  blockHeight = 0;

  constructor(
    private apiService: ApiService,
  ) { }

  ngOnInit(): void {
    this.apiService.listBisqBlockTransactions$(this.blockHash, 0, 10)
    .subscribe((response) => {
      this.bisqTransactionsCount = parseInt(response.headers.get('x-total-count'), 10);
      this.bisqTransactions = response.body;
    });

  }



}
