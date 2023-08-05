import { Injectable } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, map, switchMap } from 'rxjs';
import { StateService } from './state.service';

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  network = '';
  baseTitle = 'mempool';

  constructor(
    private titleService: Title,
    private metaService: Meta,
    private stateService: StateService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
  ) {
    this.stateService.networkChanged$.subscribe((network) => this.network = network);
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
      this.clearSoft404();
    });
  }

  setTitle(newTitle: string): void {
    this.titleService.setTitle(newTitle + ' - ' + this.getTitle());
    this.metaService.updateTag({ property: 'og:title', content: newTitle});
    this.metaService.updateTag({ property: 'twitter:title', content: newTitle});
    this.metaService.updateTag({ property: 'og:meta:ready', content: 'ready'});
  }

  resetTitle(): void {
    this.titleService.setTitle(this.getTitle());
    this.metaService.updateTag({ property: 'og:title', content: this.getTitle()});
    this.metaService.updateTag({ property: 'twitter:title', content: this.getTitle()});
    this.metaService.updateTag({ property: 'og:meta:ready', content: 'ready'});
  }

  setEnterpriseTitle(title: string) {
    this.baseTitle = title + ' - ' + this.baseTitle;
    this.resetTitle();
  }

  getTitle(): string {
    if (this.network === 'testnet')
      return this.baseTitle + ' - Bitcoin Testnet';
    if (this.network === 'signet')
      return this.baseTitle + ' - Bitcoin Signet';
    if (this.network === 'liquid')
      return this.baseTitle + ' - Liquid Network';
    if (this.network === 'liquidtestnet')
      return this.baseTitle + ' - Liquid Testnet';
    if (this.network === 'bisq')
      return this.baseTitle + ' - Bisq Markets';
    return this.baseTitle + ' - ' + (this.network ? this.ucfirst(this.network) : 'Bitcoin') + ' Explorer';
  }

  ucfirst(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  clearSoft404() {
    window['soft404'] = false;
    console.log('cleared soft 404');
  }

  logSoft404() {
    window['soft404'] = true;
    console.log('set soft 404');
  }
}
