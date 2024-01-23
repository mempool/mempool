import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { FederationUtxo } from '../../../interfaces/node-api.interface';

@Component({
  selector: 'app-federation-utxos-stats',
  templateUrl: './federation-utxos-stats.component.html',
  styleUrls: ['./federation-utxos-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationUtxosStatsComponent implements OnInit {
  @Input() federationUtxos$: Observable<FederationUtxo[]>;
  @Input() federationUtxosOneMonthAgo$: Observable<any>;

  constructor() { }

  ngOnInit(): void {
  }

}
