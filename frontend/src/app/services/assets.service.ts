import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ReplaySubject, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { shareReplay } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AssetsService {
  network = environment.network;

  getAssetsJson$: Observable<any>;
  getAssetsMinimalJson$: Observable<any>;

  constructor(
    private httpClient: HttpClient,
  ) {
    this.getAssetsJson$ = this.httpClient.get('/resources/assets.json').pipe(shareReplay());
    this.getAssetsMinimalJson$ = this.httpClient.get('/resources/assets.minimal.json').pipe(shareReplay());
  }
}
