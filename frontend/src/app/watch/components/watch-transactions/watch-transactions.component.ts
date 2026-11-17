import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Transaction } from '@interfaces/electrs.interface';
import { WalletView } from '@app/watch/wallet-math';

const PAGE_SIZE = 25;

// The history is already in memory, so scrolling pages through it rather than fetching more.
@Component({
  selector: 'app-watch-transactions',
  templateUrl: './watch-transactions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class WatchTransactionsComponent implements OnChanges {
  @Input({ required: true }) view!: WalletView;

  addresses: string[] = [];
  shown: Transaction[] = [];
  private limit = PAGE_SIZE;

  ngOnChanges(changes: SimpleChanges): void {
    const previous: WalletView | undefined = changes.view?.previousValue;
    if (previous?.wallet.id !== this.view.wallet.id) {
      this.limit = PAGE_SIZE;
    }
    if (previous?.wallet !== this.view.wallet) {
      // The list highlights inputs and outputs that belong to these addresses.
      this.addresses = this.view.wallet.addresses.map((a) => a.address);
    }
    this.shown = this.view.transactions.slice(0, this.limit);
  }

  loadMore(): void {
    if (this.shown.length < this.view.transactions.length) {
      this.limit += PAGE_SIZE;
      this.shown = this.view.transactions.slice(0, this.limit);
    }
  }
}
