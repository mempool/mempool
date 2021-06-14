import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { ServerModule, ServerTransferStateModule } from '@angular/platform-server';

import { AppModule } from './app.module';
import { AppComponent } from './components/app/app.component';
import { HttpCacheInterceptor } from './services/http-cache.interceptor';

@NgModule({
  imports: [AppModule, ServerModule, ServerTransferStateModule],
  providers: [{ provide: HTTP_INTERCEPTORS, useClass: HttpCacheInterceptor, multi: true }],
  bootstrap: [AppComponent],
})
export class AppServerModule {}
