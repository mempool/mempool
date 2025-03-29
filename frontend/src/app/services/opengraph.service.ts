import { Injectable, NgZone } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter, map, switchMap } from 'rxjs/operators';
import { combineLatest } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { LanguageService } from '@app/services/language.service';

@Injectable({
  providedIn: 'root'
})
export class OpenGraphService {
  network = '';
  defaultImageUrl = '';
  previewLoadingEvents = {}; // pending count per event type
  previewLoadingCount = 0; // number of unique events pending
  sessionId = 1;

  constructor(
    private ngZone: NgZone,
    private metaService: Meta,
    private stateService: StateService,
    private LanguageService: LanguageService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
  ) {
    // save og:image tag from original template
    const initialOgImageTag = metaService.getTag("property='og:image'");
    this.defaultImageUrl = initialOgImageTag?.content || 'https://mempool.space/resources/previews/mempool-space-preview.jpg';
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.activatedRoute),
      map(route => {
        while (route.firstChild) route = route.firstChild;
        return route;
      }),
      filter(route => route.outlet === 'primary'),
      switchMap(route => route.data),
    ).subscribe((data) => {
      if (data.ogImage) {
        this.setOgImage();
      } else {
        this.clearOgImage();
      }
    });

    // expose routing method to global scope, so we can access it from the unfurler
    window['ogService'] = {
      loadPage: (path) => { return this.loadPage(path); }
    };
  }

  setOgImage() {
    const lang = this.LanguageService.getLanguage();
    const ogImageUrl = `${window.location.protocol}//${window.location.host}/render/${lang}/preview${this.router.url}`;
    this.metaService.updateTag({ property: 'og:image', content: ogImageUrl });
    this.metaService.updateTag({ name: 'twitter:image', content: ogImageUrl });
    this.metaService.updateTag({ property: 'og:image:type', content: 'image/png' });
    this.metaService.updateTag({ property: 'og:image:width', content: '1200' });
    this.metaService.updateTag({ property: 'og:image:height', content: '600' });
  }

  clearOgImage() {
    this.metaService.updateTag({ property: 'og:image', content: this.defaultImageUrl });
    this.metaService.updateTag({ name: 'twitter:image', content: this.defaultImageUrl });
    this.metaService.updateTag({ property: 'og:image:type', content: 'image/png' });
    this.metaService.updateTag({ property: 'og:image:width', content: '1000' });
    this.metaService.updateTag({ property: 'og:image:height', content: '500' });
  }

  setManualOgImage(imageFilename) {
    const ogImage = `${window.location.protocol}//${window.location.host}/resources/previews/${imageFilename}`;
    this.metaService.updateTag({ property: 'og:image', content: ogImage });
    this.metaService.updateTag({ property: 'og:image:type', content: 'image/jpeg' });
    this.metaService.updateTag({ property: 'og:image:width', content: '2000' });
    this.metaService.updateTag({ property: 'og:image:height', content: '1000' });
    this.metaService.updateTag({ name: 'twitter:image', content: ogImage });
  }

  /// register an event that needs to resolve before we can take a screenshot
  waitFor(event: string): number {
    if (!this.previewLoadingEvents[event]) {
      this.previewLoadingEvents[event] = 1;
      this.previewLoadingCount++;
    } else {
      this.previewLoadingEvents[event]++;
    }
    this.metaService.updateTag({ property: 'og:preview:loading', content: 'loading'});
    return this.sessionId;
  }

  // mark an event as resolved
  // if all registered events have resolved, signal we are ready for a screenshot
  waitOver({ event, sessionId }: { event: string, sessionId: number }) {
    if (sessionId !== this.sessionId) {
      return;
    }
    if (this.previewLoadingEvents[event]) {
      this.previewLoadingEvents[event]--;
      if (this.previewLoadingEvents[event] === 0 && this.previewLoadingCount > 0) {
        delete this.previewLoadingEvents[event];
        this.previewLoadingCount--;
      }
    }
    if (this.previewLoadingCount === 0) {
      this.metaService.updateTag({ property: 'og:preview:ready', content: 'ready'});
    }
  }

  fail({ event, sessionId }: { event: string, sessionId: number }) {
    if (sessionId !== this.sessionId) {
      return;
    }
    if (this.previewLoadingEvents[event]) {
      this.metaService.updateTag({ property: 'og:preview:fail', content: 'fail'});
    }
  }

  resetLoading() {
    this.previewLoadingEvents = {};
    this.previewLoadingCount = 0;
    this.sessionId++;
    this.metaService.removeTag("property='og:preview:loading'");
    this.metaService.removeTag("property='og:preview:ready'");
    this.metaService.removeTag("property='og:preview:fail'");
    this.metaService.removeTag("property='og:meta:ready'");
  }

  loadPage(path) {
    if (path !== this.router.url) {
      this.resetLoading();
      this.ngZone.run(() => {
        this.router.navigateByUrl(path);
      });
    }
  }
}
