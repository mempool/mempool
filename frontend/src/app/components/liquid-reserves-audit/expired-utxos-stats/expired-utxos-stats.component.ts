import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { FederationUtxo } from '@interfaces/node-api.interface';

@Component({
  selector: 'app-expired-utxos-stats',
  templateUrl: './expired-utxos-stats.component.html',
  styleUrls: ['./expired-utxos-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpiredUtxosStatsComponent implements OnInit {
  @Input() expiredUtxos$: Observable<FederationUtxo[]>;

  stats$: Observable<any>;

  constructor() { }

  ngOnInit(): void {
    this.stats$ = this.expiredUtxos$?.pipe(
      map((utxos: FederationUtxo[]) => {
        const stats = { nonDust: { count: 0, total: 0 }, all: { count: 0, total: 0 } };
        utxos.forEach((utxo: FederationUtxo) => {
          stats.all.count++;
          stats.all.total += utxo.amount;
          if (!utxo.isDust) {
            stats.nonDust.count++;
            stats.nonDust.total += utxo.amount;
          }
        });
        return stats;
      }),
    );
  }

}
