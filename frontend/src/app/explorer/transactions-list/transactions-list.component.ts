import { Component, OnInit, Input } from '@angular/core';
import { MemPoolService } from 'src/app/services/mem-pool.service';

@Component({
  selector: 'app-transactions-list',
  templateUrl: './transactions-list.component.html',
  styleUrls: ['./transactions-list.component.scss']
})
export class TransactionsListComponent implements OnInit {
  @Input() transactions: any[];
  @Input() showConfirmations = false;
  latestBlockHeight: number;

  viewFiat = false;
  conversions: any;

  constructor(
    private memPoolService: MemPoolService,
  ) { }

  ngOnInit() {
    this.memPoolService.conversions$
      .subscribe((conversions) => {
        this.conversions = conversions;
      });

    this.memPoolService.blocks$
      .subscribe((block) => {
        this.latestBlockHeight = block.height;
      });
  }

  getTotalTxOutput(tx: any) {
    return tx.vout.map((v: any) => v.value || 0).reduce((a: number, b: number) => a + b);
  }
}
