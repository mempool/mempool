import { Component, OnInit } from '@angular/core';
import { ApiService } from 'src/app/services/api.service';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { MemPoolService } from 'src/app/services/mem-pool.service';

@Component({
  selector: 'app-transaction',
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.scss']
})
export class TransactionComponent implements OnInit {
  tx: any;
  isLoadingTx = true;
  conversions: any;
  totalOutput: number;

  viewFiat = false;
  latestBlockHeight: number;

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private memPoolService: MemPoolService,
  ) { }

  ngOnInit() {
    this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        const txId: string = params.get('id') || '';
        return this.apiService.getTransaction$(txId);
      })
    )
    .subscribe((tx) => {
      this.tx = tx;
      this.totalOutput = this.tx.vout.map((v: any) => v.value || 0).reduce((a: number, b: number) => a + b);
      this.isLoadingTx = false;
    });

    this.memPoolService.conversions$
      .subscribe((conversions) => {
        this.conversions = conversions;
      });

    this.memPoolService.blocks$
      .subscribe((block) => {
        this.latestBlockHeight = block.height;
      });
  }
}
