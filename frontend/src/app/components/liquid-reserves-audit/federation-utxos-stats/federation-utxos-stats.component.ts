import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { concat, interval, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiService } from '../../../services/api.service';
import { StateService } from '../../../services/state.service';
import { FederationAddress, FederationUtxo } from '../../../interfaces/node-api.interface';

@Component({
  selector: 'app-federation-utxos-stats',
  templateUrl: './federation-utxos-stats.component.html',
  styleUrls: ['./federation-utxos-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationUtxosStatsComponent implements OnInit {
  @Input() federationUtxos$: Observable<FederationUtxo[]>;
  @Input() federationAddresses$: Observable<FederationAddress[]>;

  federationUtxosOneMonthAgo$: Observable<FederationUtxo[]>;
  federationAddressesOneMonthAgo$: Observable<FederationAddress[]>;

  constructor(private apiService: ApiService, private stateService: StateService) { }

  ngOnInit(): void {

    // Calls this.apiService.federationUtxosOneMonthAgo$ at load and then every day
    this.federationUtxosOneMonthAgo$ = concat(
      this.apiService.federationUtxosOneMonthAgo$(),
      interval(24 * 60 * 60 * 1000).pipe(
        switchMap(() => this.apiService.federationUtxosOneMonthAgo$())
      )
    );

    // Calls this.apiService.federationAddressesOneMonthAgo$ at load and then every day
    this.federationAddressesOneMonthAgo$ = concat(
      this.apiService.federationAddressesOneMonthAgo$(),
      interval(24 * 60 * 60 * 1000).pipe(
        switchMap(() => this.apiService.federationAddressesOneMonthAgo$())
      )
    );
  }

}
