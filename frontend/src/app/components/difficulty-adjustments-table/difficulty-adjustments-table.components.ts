import { Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { formatNumber } from '@angular/common';
import { AmountShortenerPipe } from '@app/shared/pipes/amount-shortener.pipe';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-difficulty-adjustments-table',
  templateUrl: './difficulty-adjustments-table.component.html',
  styleUrls: ['./difficulty-adjustments-table.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 99;
    }
  `],
  standalone: false,
})
export class DifficultyAdjustmentsTable implements OnInit {
  hashrateObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private apiService: ApiService,
    public amountShortenerPipe: AmountShortenerPipe,
    public stateService: StateService
  ) {
  }

  ngOnInit(): void {
    let decimals = 2;
    if (this.stateService.network === 'signet') {
      decimals = 5;
    }

    this.hashrateObservable$ = this.apiService.getDifficultyAdjustments$('3m')
      .pipe(
        map((response) => {
          const data = response.body;
          const tableData = [];
          for (const adjustment of data) {
            tableData.push({
              height: adjustment[1],
              timestamp: adjustment[0],
              change: (adjustment[3] - 1) * 100,
              difficultyShorten: this.amountShortenerPipe.transform(adjustment[2], decimals)
            });
          }
          this.isLoading = false;
          return tableData.slice(0, 6);
        }),
      );
  }

  isMobile() {
    return (window.innerWidth <= 767.98);
  }
}
