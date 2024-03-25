import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ZoneService {

  constructor() { }

  wrapObservable<T>(obs: Observable<T>): Observable<T> {
    return obs;
  }
}
