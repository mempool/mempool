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
    return (!this.paymentGuard() && (preferredRoute === 'status' || (preferredRoute !== 'details' && this.navigationService.isInitialLoad())) && window.innerWidth <= 767.98 && !(path.length === 2 && ['push', 'test', 'preview'].includes(path[1].path)));
  }

  paymentGuard(route?: Route, segments?: UrlSegment[]): boolean {
    const fragmentParams = new URLSearchParams(this.router.getCurrentNavigation()?.extractedUrl.fragment || '');
    return (fragmentParams.has('destination'));
  }
}

export const TrackerGuard: CanMatchFn = (route: Route, segments: UrlSegment[]): boolean => {
  return inject(GuardService).trackerGuard(route, segments);
};

export const PaymentGuard: CanMatchFn = (route: Route, segments: UrlSegment[]): boolean => {
  return inject(GuardService).paymentGuard(route, segments);
};
