import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ReplaySubject } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AssetsService {
  network = environment.network;

  assetsMinimal$ = new ReplaySubject<any>(1);

  constructor(
    private httpClient: HttpClient,
  ) {
    if (this.network === 'liquid') {
      this.getAssetsMinimalJson$();
    }
  }

  getAssetsMinimalJson$() {
    this.httpClient.get('/assets/assets.minimal.json')
    .subscribe((data) => {
      this.assetsMinimal$.next(data);
    });
  }

  getAssetsJson$() {
    return this.httpClient.get('/assets/assets.json');
  }
}
