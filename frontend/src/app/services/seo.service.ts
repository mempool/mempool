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
    if (prependNetwork && this.network !== '') {
      networkName = this.network.substr(0, 1).toUpperCase() + this.network.substr(1) + ' ';
    }
    this.titleService.setTitle(networkName + newTitle + ' - ' + this.defaultTitle);
  }

  resetTitle() {
    this.titleService.setTitle(this.defaultTitle);
  }
}
