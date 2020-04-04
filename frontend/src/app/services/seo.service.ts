import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  network = environment.network;
  defaultTitle = 'mempool - Bitcoin Explorer';

  constructor(
    private titleService: Title,
  ) { }

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
