import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
  NavigationStart,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { EMPTY, combineLatest } from 'rxjs';
import { catchError, filter, take, takeUntil, timeout } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';

// Initial navigation is blocking, so check asynchronously to let the dashboard
// render while the node responds. Redirect only after that navigation completes.

export const syncStatusGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): boolean => {
  const apiService = inject(ApiService);
  const stateService = inject(StateService);
  const router = inject(Router);

  // Only check the first browser navigation on self-hosted instances. Later
  // dashboard visits remain available through the Return to dashboard button.
  if (
    stateService.env.OFFICIAL_MEMPOOL_SPACE ||
    !stateService.isBrowser ||
    router.navigated
  ) {
    return true;
  }

  const navigationId = router.getCurrentNavigation()?.id;
  combineLatest([
    apiService.getSyncProgress$().pipe(timeout({ first: 10000 })),
    router.events.pipe(
      filter(
        (event) => event instanceof NavigationEnd && event.id === navigationId
      ),
      take(1)
    ),
  ])
    .pipe(
      take(1),
      takeUntil(
        router.events.pipe(
          filter(
            (event) =>
              event instanceof NavigationCancel ||
              event instanceof NavigationError ||
              event instanceof NavigationStart
          )
        )
      ),
      catchError(() => EMPTY)
    )
    .subscribe(([progress]) => {
      const nodeNotReady =
        progress.ibd ||
        (progress.electrs?.reachable && !progress.electrs.indexed) ||
        !progress.mempool.inSync ||
        !progress.mempool.indexed;
      if (nodeNotReady && router.url === state.url) {
        router.navigateByUrl(
          new RelativeUrlPipe(stateService).transform('/getting-started')
        );
      }
    });

  return true;
};
