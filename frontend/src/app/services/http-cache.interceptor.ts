import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { HttpInterceptor, HttpEvent, HttpRequest, HttpHandler, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TransferState, makeStateKey } from '@angular/platform-browser';
import { isPlatformBrowser } from '@angular/common';

@Injectable()
export class HttpCacheInterceptor implements HttpInterceptor {
  isBrowser: boolean = isPlatformBrowser(this.platformId);

  constructor(private transferState: TransferState, @Inject(PLATFORM_ID) private platformId: any) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.isBrowser && request.method === 'GET') {
      const cachedResponse = this.transferState.get(makeStateKey(request.url), null);
      if (cachedResponse) {
        const modifiedResponse = new HttpResponse<any>({
          headers: cachedResponse.headers,
          body: cachedResponse.body,
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          url: cachedResponse.url,
        });
        this.transferState.remove(makeStateKey(request.url));
        return of(modifiedResponse);
      }
    }

    return next.handle(request).pipe(
      tap((event: HttpEvent<any>) => {
        if (!this.isBrowser && event instanceof HttpResponse) {
          let keyId = request.url.split('/').slice(3).join('/');
          this.transferState.set(makeStateKey('/' + keyId), event);
        }
      })
    );
  }
}
