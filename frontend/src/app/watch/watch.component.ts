import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { SeoService } from '@app/services/seo.service';
import { StateService } from '@app/services/state.service';
import { ThemeService } from '@app/services/theme.service';
import { WebsocketService } from '@app/services/websocket.service';
import { merge, Observable, of, Subscription, timer } from 'rxjs';
import { distinctUntilChanged, filter, map, pairwise } from 'rxjs/operators';
import { WalletPageState, WalletSessionService } from '@app/watch/services/wallet-session.service';
import { WalletTrackerService } from '@app/watch/services/wallet-tracker.service';

export type WatchTab = 'overview' | 'transactions' | 'utxos' | 'addresses' | 'settings';

/** The wallet refreshes on every block, so its update time is only shown once it may be stale. */
const STALE_AFTER_MS = 30 * 60 * 1000;

@Component({
  selector: 'app-watch',
  templateUrl: './watch.component.html',
  styleUrls: ['./watch.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
  // Page-scoped, so address tracking and chain watching stop when the user leaves the page.
  providers: [WalletSessionService, WalletTrackerService],
})
export class WatchComponent implements OnInit, OnDestroy {
  activeTab: WatchTab = 'overview';
  readonly isLightMode$: Observable<boolean>;
  readonly clock$ = timer(0, 60_000).pipe(map(() => Date.now()));
  private subscription: Subscription;

  constructor(
    public session: WalletSessionService,
    private stateService: StateService,
    private websocketService: WebsocketService,
    private seoService: SeoService,
    themeService: ThemeService,
  ) {
    this.isLightMode$ = themeService.themeState$.pipe(
      filter((state) => !state.loading),
      map((state) => state.theme === 'nymkappa'),
      distinctUntilChanged(),
    );
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@watch.title:Wallet`);
    this.seoService.setDescription($localize`:@@meta.description.wallet:Follow a Bitcoin wallet from its descriptor, extended public key or address list: balance, transactions, UTXOs and addresses. Addresses are derived in your browser and the key is never sent.`);
    let firstNetwork = true;
    // networkChanged$ does not emit for mainnet on first load, so start from the current value.
    this.subscription = merge(of(this.stateService.network), this.stateService.networkChanged$)
      .pipe(distinctUntilChanged())
      .subscribe((network) => {
        // The wallet refreshes on each block. A network change opens a connection that has not
        // asked for blocks yet, but want() skips a repeat of the last request, hence the force.
        this.websocketService.want(['blocks'], !firstNetwork);
        firstNetwork = false;
        this.activeTab = 'overview';
        this.session.setNetwork(network);
      });
    // A wallet that was just added opens on its Overview.
    this.subscription.add(this.session.state$.pipe(pairwise()).subscribe(([previous, current]) => {
      if (previous.adding && !current.adding && current.activeId && current.activeId !== previous.activeId) {
        this.activeTab = 'overview';
      }
    }));
  }

  showUpdatedAt(state: WalletPageState, now: number | null): boolean {
    return !!state.updatedAt && (!!state.error || (now ?? Date.now()) - state.updatedAt * 1000 > STALE_AFTER_MS);
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.seoService.resetTitle();
    this.seoService.resetDescription();
  }
}
