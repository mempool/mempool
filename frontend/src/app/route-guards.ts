import { Injectable, inject } from '@angular/core';
import { CanMatchFn, Route, Router, UrlSegment } from '@angular/router';
import { NavigationService } from './services/navigation.service';

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
    return preferredRoute !== 'details' && this.navigationService.isInitialLoad() && window.innerWidth <= 767.98;
  }
}

export const TrackerGuard: CanMatchFn = (route: Route, segments: UrlSegment[]): boolean => {
  return inject(GuardService).trackerGuard(route, segments);
};