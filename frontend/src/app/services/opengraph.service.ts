import { Injectable } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter, map, switchMap } from 'rxjs/operators';
import { combineLatest } from 'rxjs';
import { StateService } from './state.service';
import { LanguageService } from './language.service';

@Injectable({
  providedIn: 'root'
})
export class OpenGraphService {
  network = '';
  defaultImageUrl = '';

  constructor(
    private metaService: Meta,
    private stateService: StateService,
    private LanguageService: LanguageService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
  ) {
    // save og:image tag from original template
    const initialOgImageTag = metaService.getTag("property='og:image'");
    this.defaultImageUrl = initialOgImageTag?.content || 'https://mempool.space/resources/mempool-space-preview.png';
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
  }

  setOgImage() {
    const lang = this.LanguageService.getLanguage();
    const ogImageUrl = `${window.location.protocol}//${window.location.host}/render/${lang}/preview${this.router.url}`;
    this.metaService.updateTag({ property: 'og:image', content: ogImageUrl });
    this.metaService.updateTag({ property: 'twitter:image:src', content: ogImageUrl });
    this.metaService.updateTag({ property: 'og:image:type', content: 'image/png' });
    this.metaService.updateTag({ property: 'og:image:width', content: '1024' });
    this.metaService.updateTag({ property: 'og:image:height', content: '512' });
  }

  clearOgImage() {
    this.metaService.updateTag({ property: 'og:image', content: this.defaultImageUrl });
    this.metaService.updateTag({ property: 'twitter:image:src', content: this.defaultImageUrl });
    this.metaService.updateTag({ property: 'og:image:type', content: 'image/png' });
    this.metaService.updateTag({ property: 'og:image:width', content: '1000' });
    this.metaService.updateTag({ property: 'og:image:height', content: '500' });
  }

  /// signal that the unfurler should wait for a 'ready' signal before taking a screenshot
  setPreviewLoading() {
    this.metaService.updateTag({ property: 'og:loading', content: 'loading'});
  }

  // signal to the unfurler that the page is ready for a screenshot
  setPreviewReady() {
    this.metaService.updateTag({ property: 'og:ready', content: 'ready'});
  }
}
