import { Injectable } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
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
  ) {
    this.stateService.networkChanged$.subscribe((network) => this.network = network);
  }

  setTitle(newTitle: string): void {
    this.titleService.setTitle(newTitle + ' - ' + this.getTitle());
    this.metaService.updateTag({ property: 'og:title', content: newTitle});
  }

  resetTitle(): void {
    this.titleService.setTitle(this.getTitle());
    this.metaService.updateTag({ property: 'og:title', content: this.getTitle()});
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
}
