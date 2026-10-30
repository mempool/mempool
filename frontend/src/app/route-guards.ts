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
    const currentUrl = this.router.getCurrentNavigation()?.extractedUrl;
    if (!currentUrl) {
      return false;
    }
    const preferredRoute = currentUrl.queryParams?.mode;
    const path = currentUrl.root.children.primary.segments;
    const hasPayjoinFragment = new URLSearchParams(currentUrl.fragment || '').has('pj');
    return !hasPayjoinFragment && (preferredRoute === 'status' || (preferredRoute !== 'details' && this.navigationService.isInitialLoad())) && window.innerWidth <= 767.98 && !(path.length === 2 && ['push', 'test', 'preview'].includes(path[1].path));
  }
}

export const TrackerGuard: CanMatchFn = (route: Route, segments: UrlSegment[]): boolean => {
  return inject(GuardService).trackerGuard(route, segments);
};
