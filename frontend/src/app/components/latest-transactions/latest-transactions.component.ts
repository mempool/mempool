import { Component, OnInit } from '@angular/core';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { Observable, timer } from 'rxjs';
import { Recent } from '../../interfaces/electrs.interface';
import { flatMap, tap } from 'rxjs/operators';

@Component({
  selector: 'app-latest-transactions',
  templateUrl: './latest-transactions.component.html',
  styleUrls: ['./latest-transactions.component.scss']
})
export class LatestTransactionsComponent implements OnInit {
  transactions$: Observable<Recent[]>;
  isLoading = true;

  constructor(
    private electrsApiService: ElectrsApiService,
  ) { }

  ngOnInit() {
    this.transactions$ = timer(0, 10000)
      .pipe(
        flatMap(() => {
          return this.electrsApiService.getRecentTransaction$()
            .pipe(
              tap(() => this.isLoading = false)
            );
        })
      );
  }
}
