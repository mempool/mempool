import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { derivationPath, WalletView } from '@app/watch/wallet-math';
import { DerivedAddress } from '@app/watch/watch.types';

type AddressUsage = 'used' | 'unused' | 'unknown';

export interface AddressRow {
  derived: DerivedAddress;
  path: string;
  balance: number;
  usage: AddressUsage;
}

type ChainFilter = 'all' | 'receive' | 'change';
type UsageFilter = 'all' | 'unused' | 'used';

@Component({
  selector: 'app-watch-addresses',
  templateUrl: './watch-addresses.component.html',
  styleUrls: ['./watch-addresses.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class WatchAddressesComponent implements OnChanges {
  @Input({ required: true }) view!: WalletView;

  readonly usageLabels: Record<AddressUsage, string> = {
    used: $localize`:@@watch.address-used:Used`,
    unused: $localize`:@@watch.address-unused:Unused`,
    unknown: $localize`:@@watch.address-usage-unknown:Unknown: the history is incomplete`,
  };

  chainFilter: ChainFilter = 'all';
  usageFilter: UsageFilter = 'all';
  fundedOnly = false;

  isAddressList = false;
  rows: AddressRow[] = [];
  visible: AddressRow[] = [];
  stats = { total: 0, used: 0, funded: 0 };

  ngOnChanges(): void {
    this.isAddressList = this.view.wallet.kind === 'address-list';
    if (this.isAddressList) {
      this.chainFilter = 'all';
    }
    this.rows = this.buildRows(this.view);
    this.stats = {
      total: this.rows.length,
      used: this.rows.filter((r) => r.usage === 'used').length,
      funded: this.rows.filter((r) => r.balance > 0).length,
    };
    this.applyFilters();
  }

  applyFilters(): void {
    this.visible = this.rows.filter((row) =>
      (this.chainFilter === 'all' || row.derived.chain === (this.chainFilter === 'receive' ? 0 : 1))
      && (this.usageFilter === 'all' || row.usage === this.usageFilter)
      && (!this.fundedOnly || row.balance > 0));
  }

  trackByAddress(_: number, row: AddressRow): string {
    return row.derived.address;
  }

  private buildRows(view: WalletView): AddressRow[] {
    const balances = new Map<string, number>();
    for (const utxo of view.utxos) {
      balances.set(utxo.address, (balances.get(utxo.address) ?? 0) + utxo.value);
    }
    return [...view.wallet.addresses]
      .sort((a, b) => a.chain - b.chain || a.index - b.index)
      .map((derived) => ({
        derived,
        path: derivationPath(view.wallet, derived),
        balance: balances.get(derived.address) ?? 0,
        usage: view.used.has(derived.address) ? 'used' : view.truncated ? 'unknown' : 'unused',
      }));
  }
}
