import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
@Component({
  selector: 'app-federation-utxos-stats',
  templateUrl: './federation-utxos-stats.component.html',
  styleUrls: ['./federation-utxos-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationUtxosStatsComponent implements OnInit {
  constructor() { }

  ngOnInit(): void {
    
  }

}
