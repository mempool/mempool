import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { BisqTransaction } from 'src/app/interfaces/bisq.interfaces';
import { switchMap } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { of } from 'rxjs';

@Component({
  selector: 'app-bisq-transaction',
  templateUrl: './bisq-transaction.component.html',
  styleUrls: ['./bisq-transaction.component.scss']
})
export class BisqTransactionComponent implements OnInit {
  bisqTx: BisqTransaction;
  txId: string;

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
  ) { }

  ngOnInit(): void {
    this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        this.txId = params.get('id') || '';
        if (history.state.bsqTx) {
          return of(history.state.bsqTx);
        }
        return this.apiService.getBisqTransaction$(this.txId);
      })
    )
    .subscribe((tx) => {
      this.bisqTx = tx;
    });
  }
}
