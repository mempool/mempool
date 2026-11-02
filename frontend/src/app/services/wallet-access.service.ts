import { Injectable, Injector } from '@angular/core';
import { Observable, of } from 'rxjs';
import { distinctUntilChanged, map, shareReplay } from 'rxjs/operators';
import { StateService } from '@app/services/state.service';
import { IUser, ServicesApiServices } from '@app/services/services-api.service';

const WALLET_INVITE_FEATURE = 'mempool-wallet';

// Whole names only: `wallet` and `apiwallet` are other features.
export function hasWalletInvite(user: IUser | null | undefined): boolean {
  return typeof user?.features === 'string' && user.features.split(',').includes(WALLET_INVITE_FEATURE);
}

// Not Liquid (confidential transactions need blinding keys), testnet4 (/testnet4/wallet is the
// address-group page) or regtest.
const WALLET_NETWORKS = ['', 'testnet', 'signet'];

// Shared by the route guard and the nav link so they agree. Holds no wallet code.
@Injectable({
  providedIn: 'root'
})
export class WalletAccessService {
  /** Waits for the account lookup when an invite is required, then follows login changes. */
  readonly walletAvailable$: Observable<boolean>;

  constructor(private stateService: StateService, injector: Injector) {
    const { WALLET_ENABLED, WALLET_REQUIRES_INVITE } = stateService.env;
    if (WALLET_ENABLED !== true) {
      this.walletAvailable$ = of(false);
    } else if (WALLET_REQUIRES_INVITE !== true) {
      this.walletAvailable$ = of(true);
    } else {
      // Injected only here, so instances without a services backend never touch it.
      this.walletAvailable$ = injector.get(ServicesApiServices).userSubject$.pipe(
        map(hasWalletInvite),
        distinctUntilChanged(),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
  }

  runsOn(network: string): boolean {
    return WALLET_NETWORKS.includes(network);
  }

  // As StateService.setNetworkBasedonUrl reads it. The guard can't use StateService.network,
  // which can still hold the previous page's network while routes match.
  networkOfUrl(url: string): string {
    const env = this.stateService.env;
    const match = url.match(/^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?(?:preview\/)?(testnet4?|signet|regtest)(?:$|[/?#])/);
    const network = match?.[1] ?? env.ROOT_NETWORK ?? '';
    if (env.BASE_MODULE === 'liquid') {
      return network === 'testnet' ? 'liquidtestnet' : 'liquid';
    }
    return network;
  }
}
