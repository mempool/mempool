import { Injectable, inject } from '@angular/core';
import { CanMatchFn, Route, Router, UrlSegment } from '@angular/router';
import { NavigationService } from '@app/services/navigation.service';

@Injectable({
  providedIn: 'root'
})
class GuardService {
  constructor(
    private router: Router,
    private navigationService: NavigationService,
  ) {}

  trackerGuard(route: Route, segments: UrlSegment[]): boolean {
    const preferredRoute = this.router.getCurrentNavigation()?.extractedUrl.queryParams?.mode;
    const path = this.router.getCurrentNavigation()?.extractedUrl.root.children.primary.segments;
    return (preferredRoute === 'status' || (preferredRoute !== 'details' && this.navigationService.isInitialLoad())) && window.innerWidth <= 767.98 && !(path.length === 2 && ['push', 'test', 'preview'].includes(path[1].path));
  }

  private isNetworkEnabled(network: string): boolean {
    const env = (window as { __env?: { TESTNET_ENABLED?: boolean; TESTNET4_ENABLED?: boolean; SIGNET_ENABLED?: boolean } }).__env || {};
    switch (network) {
      case 'testnet': return !!env.TESTNET_ENABLED;
      case 'testnet4': return !!env.TESTNET4_ENABLED;
      case 'signet': return !!env.SIGNET_ENABLED;
      default: return true;
    }
  }

  networkEnabledGuard(route: Route, segments: UrlSegment[]): boolean {
    const network = (route.path ?? segments[0]?.path ?? '') as string;
    if (!this.isNetworkEnabled(network)) {
      this.router.navigateByUrl('/');
      return false;
    }
    return true;
  }
}

export const TrackerGuard: CanMatchFn = (route: Route, segments: UrlSegment[]): boolean => {
  return inject(GuardService).trackerGuard(route, segments);
};

export const NetworkEnabledGuard: CanMatchFn = (route, segments) =>
  inject(GuardService).networkEnabledGuard(route, segments);
