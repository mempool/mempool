import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable, combineLatest, map } from 'rxjs';
import { CurrentPegs } from '@interfaces/node-api.interface';

@Component({
  selector: 'app-reserves-ratio-stats',
  templateUrl: './reserves-ratio-stats.component.html',
  styleUrls: ['./reserves-ratio-stats.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservesRatioStatsComponent implements OnInit {
  @Input() fullHistory$: Observable<any>;
  @Input() currentReserves$: Observable<CurrentPegs>;
  @Input() currentPeg$: Observable<CurrentPegs>;
  @Input() emergencyUtxosStats$: Observable<any>;
  incidentCount$: Observable<{ total: number | null }>;
  reserveBalance$: Observable<{ amount: number }>;

  ngOnInit(): void {
    if (this.fullHistory$) {
      this.incidentCount$ = this.fullHistory$.pipe(
        map((fullHistory) => {
          const pegsSeries = fullHistory?.liquidPegs?.series || [];
          const reservesSeries = fullHistory?.liquidReserves?.series || [];
          if (pegsSeries.length < 2 || pegsSeries.length !== reservesSeries.length) {
            return { total: null };
          }
          // Only check the last 3 years
          let ratioSeries = reservesSeries.map((value: number, index: number) => value / pegsSeries[index]);
          return { total: ratioSeries.slice(-36).filter((ratio: number) => ratio < 0.95).length };
        })
      );
    }

    if (!this.currentReserves$ || !this.currentPeg$) {
      return;
    }
    this.reserveBalance$ = combineLatest([this.currentReserves$, this.currentPeg$]).pipe(
      map(([reserves, pegs]) => ({
        amount: (+reserves.amount - +pegs.amount) / 100000000,
      }))
    );
  }
}
