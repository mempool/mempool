import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, timer, mergeMap, of } from 'rxjs';

export class AppPreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: Function): Observable<any> {
      return route.data && route.data.preload 
          ? timer(1500).pipe(mergeMap(() => load()))
          : of(null);
    }
}
