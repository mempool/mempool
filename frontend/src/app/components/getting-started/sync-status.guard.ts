import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { EMPTY } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';

// Sends someone opening a self-hosted instance for the first time to the Getting
// Started page while the node is still setting itself up (Bitcoin Core IBD or
// electrs indexing).
//
// It deliberately never blocks the navigation it runs on. The router is
// configured with initialNavigation: 'enabledBlocking', so returning an
// Observable here would hold back the whole bootstrap — and with it the first
// paint of the app — until this request came back. The dashboard renders
// immediately instead, and the redirect happens afterwards if the answer says
// it should.

export const syncStatusGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): boolean => {
  const apiService = inject(ApiService);
  const stateService = inject(StateService);
  const router = inject(Router);

  // This is an aid for freshly installed self-hosted nodes, so the official site
  // — which is never in that state — should not even ask.
  // Skip on the server (SSR/prerender) too: this is a client-side UX, and the
  // redirect belongs in the browser. And only on the very first navigation;
  // afterwards leave the user free to come back to the dashboard.
  if (
    stateService.env.OFFICIAL_MEMPOOL_SPACE ||
    !stateService.isBrowser ||
    router.navigated
  ) {
    return true;
  }

  apiService
    .getSyncProgress$()
    .pipe(
      timeout({ first: 1500 }),
      catchError(() => EMPTY)
    )
    .subscribe((progress) => {
      // Only signals that genuinely mean "freshly set up node" belong here.
      // mempool.inSync and mempool.indexed are process-lifecycle flags — they
      // are false right after every backend restart, and inSync also drops
      // during healthy operation (mempool clear protection on a bitcoind
      // restart), so they are reported on the page but never trigger a redirect.
      const nodeNotReady = progress.ibd || progress.electrs?.indexed === false;
      // Only act if the user is still looking at the page we were asked about.
      // Comparing against the settled URL fails safe: a race leaves them on the
      // dashboard rather than pulling them off a page they navigated to.
      if (nodeNotReady && router.url === state.url) {
        router.navigateByUrl(
          new RelativeUrlPipe(stateService).transform('/getting-started')
        );
      }
    });

  return true;
};
