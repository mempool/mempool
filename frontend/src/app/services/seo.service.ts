import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { StateService } from './state.service';

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  network = '';
  defaultTitle = 'mempool - Bitcoin Explorer';

  constructor(
    private titleService: Title,
    private stateService: StateService,
  ) {
    this.stateService.networkChanged$.subscribe((network) => this.network = network);
  }

  setTitle(newTitle: string, prependNetwork = false) {
    let networkName = '';
    if (prependNetwork) {
      if (this.network === 'liquid') {
        networkName = 'Liquid ';
      } else if (this.network === 'testnet') {
        networkName = 'Testnet ';
      }
    }

    this.titleService.setTitle(networkName + newTitle + ' - ' + this.defaultTitle);
  }

  resetTitle() {
    this.titleService.setTitle(this.defaultTitle);
  }
}
