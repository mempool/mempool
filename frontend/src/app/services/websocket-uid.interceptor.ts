import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpEvent, HttpRequest, HttpHandler } from '@angular/common/http';
import { Observable } from 'rxjs';
import { StateService } from './state.service';

@Injectable()
export class WebsocketUidInterceptor implements HttpInterceptor {

  constructor(
    private stateService: StateService,
  ) { }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const newRequest = request.clone({
      headers: request.headers.set('uid', this.stateService.getWebSocketUid())
    });
    return next.handle(newRequest);
  }
}
