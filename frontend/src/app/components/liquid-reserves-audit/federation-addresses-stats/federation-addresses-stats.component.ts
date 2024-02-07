import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { FederationAddress } from '../../../interfaces/node-api.interface';

@Component({
  selector: 'app-federation-addresses-stats',
  templateUrl: './federation-addresses-stats.component.html',
  styleUrls: ['./federation-addresses-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationAddressesStatsComponent implements OnInit {
  @Input() federationAddresses$: Observable<FederationAddress[]>;
  @Input() federationAddressesOneMonthAgo$: Observable<any>;

  constructor() { }

  ngOnInit(): void {
  }

}
