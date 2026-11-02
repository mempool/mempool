import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { AddressTxSummary, Transaction } from '@interfaces/electrs.interface';
import { BehaviorSubject } from 'rxjs';
import { WalletPageState, WalletSessionService } from '@app/watch/services/wallet-session.service';
import { addressMapOf, derivationPath, netValue, upcomingReceiveAddresses, WalletView } from '@app/watch/wallet-math';
import { DerivedAddress } from '@app/watch/watch.types';
import type { WatchTab } from '@app/watch/watch.component';

const RECENT_COUNT = 5;

@Component({
  selector: 'app-watch-overview',
  templateUrl: './watch-overview.component.html',
  styleUrls: ['./watch-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class WatchOverviewComponent implements OnChanges {
  @Input({ required: true }) state!: WalletPageState;
  @Output() openTab = new EventEmitter<WatchTab>();

  /** <app-address-graph> takes an observable of newest-first summaries. */
  history$ = new BehaviorSubject<AddressTxSummary[]>([]);
  receive: DerivedAddress | null = null;
  receivePath = '';
  isAddressList = false;
  hasNextReceive = false;
  recent: { tx: Transaction; value: number }[] = [];

  private shownView: WalletView | null = null;

  constructor(public session: WalletSessionService) {}

  get view(): WalletView | null {
    return this.state.view;
  }

  ngOnChanges(): void {
    const view = this.state.view;
    if (view === this.shownView) {
      return;
    }
    this.shownView = view;
    if (!view) {
      this.receive = null;
      this.recent = [];
      return;
    }
    if (view.history !== this.history$.value) {
      this.history$.next(view.history);
    }
    const [receive, next] = upcomingReceiveAddresses(view, 2);
    this.receive = receive ?? null;
    this.receivePath = receive ? derivationPath(view.wallet, receive) : '';
    this.isAddressList = view.wallet.kind === 'address-list';
    this.hasNextReceive = !this.isAddressList && !!next;
    const map = addressMapOf(view.wallet);
    this.recent = view.transactions.slice(0, RECENT_COUNT).map((tx) => ({ tx, value: netValue(tx, map) }));
  }

  get pendingSign(): string {
    const pending = this.state.view?.balance.pending ?? 0;
    return pending > 0 ? '+' : pending < 0 ? '-' : '';
  }

  get pendingMagnitude(): number {
    return Math.abs(this.state.view?.balance.pending ?? 0);
  }

  get loadingTitle(): string {
    switch (this.state.progress?.phase) {
      case 'deriving': return $localize`:@@watch.loading-deriving:Deriving addresses`;
      case 'fetching': return $localize`:@@watch.loading-fetching:Loading address history`;
      default: return $localize`:@@watch.loading-wallet:Loading wallet…`;
    }
  }

  trackByTxid(_: number, item: { tx: Transaction }): string {
    return item.tx.txid;
  }
}
