import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';

// Redirects to the Getting Started page on the INITIAL app load while the node
// is still doing its first-time setup (Bitcoin Core IBD or electrs indexing).

export const syncStatusGuard: CanActivateFn = (): Observable<
  boolean | UrlTree
> => {
  const apiService = inject(ApiService);
  const stateService = inject(StateService);
  const router = inject(Router);

  // Skip on the server (SSR/prerender): this is a client-side polling UX, so the
  // redirect belongs in the browser and we avoid a backend call during render.
  // Also only intercept the very first navigation; afterwards leave the user free.
  if (!stateService.isBrowser || router.navigated) {
    return of(true);
  }

  return apiService.getSyncProgress$().pipe(
    // Never let this check delay the dashboard: a slow or hung backend falls
    // through to the normal page via the catchError below.
    timeout({ first: 1500 }),
    map((progress) => {
      // Only signals that genuinely mean "freshly set up node" belong here.
      // mempool.inSync and mempool.indexed are process-lifecycle flags — they
      // are false right after every backend restart, and inSync also drops
      // during healthy operation (mempool clear protection on a bitcoind
      // restart), so they are reported on the page but never trigger a redirect.
      const nodeNotReady = progress.ibd || progress.electrs?.indexed === false;
      if (nodeNotReady) {
        return router.parseUrl(
          new RelativeUrlPipe(stateService).transform('/getting-started')
        );
      }
      return true;
    }),
    catchError(() => of(true))
  );
};
