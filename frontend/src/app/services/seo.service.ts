import { Injectable } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  defaultTitle = 'mempool - Bitcoin Explorer';

  constructor(
    private titleService: Title,
  ) { }

  setTitle(newTitle: string) {
    this.titleService.setTitle(newTitle + ' - ' + this.defaultTitle);
  }

  resetTitle() {
    this.titleService.setTitle(this.defaultTitle);
  }
}
