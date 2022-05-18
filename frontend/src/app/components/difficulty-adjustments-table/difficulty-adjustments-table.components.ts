import { Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { formatNumber } from '@angular/common';
import { selectPowerOfTen } from 'src/app/bitcoin.utils';

@Component({
  selector: 'app-difficulty-adjustments-table',
  templateUrl: './difficulty-adjustments-table.component.html',
  styleUrls: ['./difficulty-adjustments-table.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 100;
    }
  `],
})
export class DifficultyAdjustmentsTable implements OnInit {
  hashrateObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private apiService: ApiService,
  ) {
  }

  ngOnInit(): void {
    this.hashrateObservable$ = this.apiService.getHistoricalHashrate$('1y')
      .pipe(
        map((response) => {
          const data = response.body;
          const availableTimespanDay = (
            (new Date().getTime() / 1000) - (data.oldestIndexedBlockTimestamp)
          ) / 3600 / 24;

          const tableData = [];
          for (let i = data.difficulty.length - 1; i > 0; --i) {
            const selectedPowerOfTen: any = selectPowerOfTen(data.difficulty[i].difficulty);
            const change = (data.difficulty[i].difficulty / data.difficulty[i - 1].difficulty - 1) * 100;

            tableData.push(Object.assign(data.difficulty[i], {
              change: Math.round(change * 100) / 100,
              difficultyShorten: formatNumber(
                data.difficulty[i].difficulty / selectedPowerOfTen.divider,
                this.locale, '1.2-2') + selectedPowerOfTen.unit
            }));
          }
          this.isLoading = false;

          return {
            availableTimespanDay: availableTimespanDay,
            difficulty: tableData.slice(0, 6),
          };
        }),
      );
  }

  isMobile() {
    return (window.innerWidth <= 767.98);
  }
}
