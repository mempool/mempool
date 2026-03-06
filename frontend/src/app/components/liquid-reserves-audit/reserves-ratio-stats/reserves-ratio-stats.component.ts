import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable, map } from 'rxjs';

@Component({
  selector: 'app-reserves-ratio-stats',
  templateUrl: './reserves-ratio-stats.component.html',
  styleUrls: ['./reserves-ratio-stats.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservesRatioStatsComponent implements OnInit {
  @Input() fullHistory$: Observable<any>;
  @Input() emergencyUtxosStats$: Observable<any>;
  unbackedMonths$: Observable<any>;

  constructor() { }

  ngOnInit(): void {
    if (!this.fullHistory$) {
      return;
    }
    this.unbackedMonths$ = this.fullHistory$
      .pipe(
        map((fullHistory) => {
          const pegsSeries = fullHistory?.liquidPegs?.series || [];
          const reservesSeries = fullHistory?.liquidReserves?.series || [];
          if (pegsSeries.length < 2 || pegsSeries.length !== reservesSeries.length) {
            return {
              historyComplete: false,
              total: null
            };
          }
          // Only check the last 3 years
          let ratioSeries = reservesSeries.map((value: number, index: number) => value / pegsSeries[index]);
          ratioSeries = ratioSeries.slice(Math.max(ratioSeries.length - 36, 0));
          let total = 0;
          for (let i = 0; i < ratioSeries.length; i++) {
            if (ratioSeries[i] < 0.95) {
              total++;
            }
          }
          const currentBalance = reservesSeries[reservesSeries.length - 1];
          const previousBalance = reservesSeries[reservesSeries.length - 2];
          const delta1m = currentBalance - previousBalance;
          return {
            historyComplete: true,
            total: total,
            delta1m: delta1m,
          };
        })
      );

  }

}
