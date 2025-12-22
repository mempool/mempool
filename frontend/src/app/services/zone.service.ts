import { ApplicationRef, Injectable } from '@angular/core';
import { Observable, Subscriber } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ZoneService {

  constructor(
    private appRef: ApplicationRef,
  ) { }

  wrapObservable<T>(obs: Observable<T>): Observable<T> {
    return new Observable((subscriber: Subscriber<T>) => {
      const subscription = obs.subscribe(
        value => {
          subscriber.next(value);
          this.appRef.tick();
        },
        err => {
          subscriber.error(err);
          this.appRef.tick();
        },
        () => {
          subscriber.complete();
          this.appRef.tick();
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    });
  }
}
