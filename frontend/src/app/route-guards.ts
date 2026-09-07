import { Injectable, inject } from '@angular/core';
import { CanMatchFn, Route, Router, UrlSegment } from '@angular/router';
import { NavigationService } from '@app/services/navigation.service';
import { isMobile } from '@app/shared/common.utils';

@Injectable({
  providedIn: 'root'
})
class GuardService {
  constructor(
    private router: Router,
    private navigationService: NavigationService,
  ) {}

  trackerGuard(route: Route, segments: UrlSegment[]): boolean {
    const preferredRoute = this.preferredRoute();
    return (preferredRoute === 'status' || (!this.hasPaymentDestination() && preferredRoute !== 'details' && this.navigationService.isInitialLoad())) && isMobile() && !this.isReservedTxPath();
  }

  paymentGuard(route: Route, segments: UrlSegment[]): boolean {
    const preferredRoute = this.preferredRoute();
    return this.hasPaymentDestination() && !['status', 'details'].includes(preferredRoute || '') && !this.isReservedTxPath();
  }

  private preferredRoute(): string | undefined {
    return this.router.getCurrentNavigation()?.extractedUrl.queryParams?.mode;
  }

  private hasPaymentDestination(): boolean {
    return new URLSearchParams(this.router.getCurrentNavigation()?.extractedUrl.fragment || '').has('destination');
  }

  private isReservedTxPath(): boolean {
    const path = this.router.getCurrentNavigation()?.extractedUrl.root.children.primary?.segments;
    return path?.length === 2 && ['push', 'test', 'preview'].includes(path[1].path);
  }
}

export const TrackerGuard: CanMatchFn = (route: Route, segments: UrlSegment[]): boolean => {
  return inject(GuardService).trackerGuard(route, segments);
};

export const PaymentGuard: CanMatchFn = (route: Route, segments: UrlSegment[]): boolean => {
  return inject(GuardService).paymentGuard(route, segments);
};
