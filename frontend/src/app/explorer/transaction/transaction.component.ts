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
  error: any;

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private memPoolService: MemPoolService,
  ) { }

  ngOnInit() {
    this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        this.error = undefined;
        const txId: string = params.get('id') || '';
        return this.apiService.getTransaction$(txId);
      })
    )
    .subscribe((tx) => {
      this.tx = tx;
      this.isLoadingTx = false;
    },
    (error) => {
      this.error = error;
      this.isLoadingTx = false;
    });

    this.memPoolService.conversions$
      .subscribe((conversions) => {
        this.conversions = conversions;
      });
  }
}
