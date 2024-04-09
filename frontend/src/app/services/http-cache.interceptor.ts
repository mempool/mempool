import { Inject, Injectable, PLATFORM_ID, makeStateKey, TransferState } from '@angular/core';
import { HttpInterceptor, HttpEvent, HttpRequest, HttpHandler, HttpResponse, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { isPlatformBrowser } from '@angular/common';

@Injectable()
export class HttpCacheInterceptor implements HttpInterceptor {
  isBrowser: boolean = isPlatformBrowser(this.platformId);

  constructor(
    private transferState: TransferState,
    @Inject(PLATFORM_ID) private platformId: any,
  ) { }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.isBrowser && request.method === 'GET') {

      const { response, headers } = this.transferState.get<any>(makeStateKey(request.url), null) || {};
      if (response) {
        const httpHeaders = new HttpHeaders();
        for (const [k,v] of Object.entries(headers)) {
          httpHeaders.set(k,v as string[]);
        }
        const modifiedResponse = new HttpResponse<any>({
          headers: httpHeaders,
          body: response.body,
          status: response.status,
          statusText: response.statusText,
          url: response.url
        });
        this.transferState.remove(makeStateKey(request.url));
        return of(modifiedResponse);
      }
    }

    return next.handle(request)
      .pipe(
        tap((event: HttpEvent<any>) => {
          if (!this.isBrowser && event instanceof HttpResponse) {
            let keyId = request.url.split('/').slice(3).join('/');
            const headers = {};
            for (const k of event.headers.keys()) {
              headers[k] = event.headers.getAll(k);
            }
            this.transferState.set<any>(makeStateKey('/' + keyId), { response: event, headers });
          }
        }),
        catchError((e) => {
          if (e instanceof HttpErrorResponse) {
            if (e.status === 0) {
              throw new HttpErrorResponse({
                error: 'Unknown error',
                headers: e.headers,
                status: 0,
                statusText: 'Unknown error',
                url: e.url,
              });
            } else {
              throw e;
            }
          } else {
            const msg = e?.['message'] || 'Unknown error';
            throw new HttpErrorResponse({
              error: msg,
              headers: new HttpHeaders(),
              status: 0,
              statusText: msg,
              url: '',
            });
          }
        })
      );
  }
}
