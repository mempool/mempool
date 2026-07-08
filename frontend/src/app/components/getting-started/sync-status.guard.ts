import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';

// Redirects to the Getting Started page on the INITIAL app load while the node

export const syncStatusGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
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
    map((progress) => {
      const nodeNotReady =
        progress.ibd ||
        (progress.electrs != null && !progress.electrs.indexed) ||
        (progress.mempool != null &&
          (!progress.mempool.inSync || !progress.mempool.indexed));
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
