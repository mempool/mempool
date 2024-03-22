import { ApplicationRef, Injectable, NgZone } from '@angular/core';
import { Observable, Subscriber } from 'rxjs';

// global Zone object provided by zone.js
declare const Zone: any;

@Injectable({
  providedIn: 'root'
})
export class ZoneService {

  constructor(
    private ngZone: NgZone,
    private appRef: ApplicationRef,
  ) { }

  wrapObservable<T>(obs: Observable<T>): Observable<T> {
    return new Observable((subscriber: Subscriber<T>) => {
      let task: any;

      this.ngZone.run(() => {
        task = Zone.current.scheduleMacroTask('wrapObservable', () => {}, {}, () => {}, () => {});
      });

      const subscription = obs.subscribe(
        value => {
          subscriber.next(value);
          if (task) {
            this.ngZone.run(() => {
              this.appRef.tick();
            });
            task.invoke();
          }
        },
        err => {
          subscriber.error(err);
          if (task) {
            this.appRef.tick();
            task.invoke();
          }
        },
        () => {
          subscriber.complete();
          if (task) {
            this.appRef.tick();
            task.invoke();
          }
        }
      );

      return () => {
        subscription.unsubscribe();
        if (task) {
          this.appRef.tick();
          task.invoke();
        }
      };
    });
  }
}
