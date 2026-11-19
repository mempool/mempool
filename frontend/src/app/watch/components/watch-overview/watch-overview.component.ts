import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { AddressTxSummary } from '@interfaces/electrs.interface';
import { BehaviorSubject } from 'rxjs';
import { WalletPageState } from '@app/watch/services/wallet-session.service';
import { WalletView } from '@app/watch/wallet-math';

@Component({
  selector: 'app-watch-overview',
  templateUrl: './watch-overview.component.html',
  styleUrls: ['./watch-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class WatchOverviewComponent implements OnChanges {
  @Input({ required: true }) state!: WalletPageState;

  /** <app-address-graph> takes an observable of newest-first summaries. */
  history$ = new BehaviorSubject<AddressTxSummary[]>([]);

  private shownView: WalletView | null = null;

  get view(): WalletView | null {
    return this.state.view;
  }

  ngOnChanges(): void {
    const view = this.state.view;
    if (view === this.shownView) {
      return;
    }
    this.shownView = view;
    if (view && view.history !== this.history$.value) {
      this.history$.next(view.history);
    }
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
}
