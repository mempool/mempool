import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable, map } from 'rxjs';

@Component({
  selector: 'app-reserves-ratio-stats',
  templateUrl: './reserves-ratio-stats.component.html',
  styleUrls: ['./reserves-ratio-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservesRatioStatsComponent implements OnInit {
  @Input() fullHistory$: Observable<any>;
  @Input() emergencyUtxosStats$: Observable<any>;
  unbackedMonths$: Observable<any>

  constructor() { }

  ngOnInit(): void {
    if (!this.fullHistory$) {
      return;
    }
    this.unbackedMonths$ = this.fullHistory$
      .pipe(
        map((fullHistory) => {
          if (fullHistory.liquidPegs.series.length !== fullHistory.liquidReserves.series.length) {
            return {
              historyComplete: false, 
              total: null
            };
          }
          // Only check the last 3 years
          let ratioSeries = fullHistory.liquidReserves.series.map((value: number, index: number) => value / fullHistory.liquidPegs.series[index]);
          ratioSeries = ratioSeries.slice(Math.max(ratioSeries.length - 36, 0));          
          let total = 0;
          let avg = 0;
          for (let i = 0; i < ratioSeries.length; i++) {
            avg += ratioSeries[i];
            if (ratioSeries[i] < 0.95) {
              total++;
            }
          }
          avg = avg / ratioSeries.length;
          return {
            historyComplete: true, 
            total: total,
            avg: avg,
          };
        })
      );

  }

}
