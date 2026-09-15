import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable, combineLatest, map, shareReplay } from 'rxjs';
import { CurrentPegs } from '@interfaces/node-api.interface';

@Component({
  selector: 'app-reserves-ratio-stats',
  templateUrl: './reserves-ratio-stats.component.html',
  styleUrls: ['./reserves-ratio-stats.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservesRatioStatsComponent implements OnInit {
  @Input() currentReserves$: Observable<CurrentPegs>;
  @Input() currentPeg$: Observable<CurrentPegs>;
  @Input() emergencyUtxosStats$: Observable<any>;
  reserveBalance$: Observable<{ amount: number }>;

  ngOnInit(): void {
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
