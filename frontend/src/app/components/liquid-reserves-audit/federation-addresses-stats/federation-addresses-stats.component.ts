import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable, combineLatest, map, of } from 'rxjs';

@Component({
  selector: 'app-federation-addresses-stats',
  templateUrl: './federation-addresses-stats.component.html',
  styleUrls: ['./federation-addresses-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationAddressesStatsComponent implements OnInit {
  @Input() federationAddressesNumber$: Observable<number>;
  @Input() federationUtxosNumber$: Observable<number>;
  federationWalletStats$: Observable<any>;

  constructor() { }

  ngOnInit(): void {
    this.federationWalletStats$ = combineLatest([
      this.federationAddressesNumber$ ?? of(undefined),
      this.federationUtxosNumber$ ?? of(undefined)
    ]).pipe(
      map(([address_count, utxo_count]) => {
        if (address_count === undefined || utxo_count === undefined) {
          return undefined;
        }
        return { address_count, utxo_count}
      })
    )
  }

}
