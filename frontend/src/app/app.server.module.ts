import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { ServerModule } from '@angular/platform-server';

import { ZONE_SERVICE } from './injection-tokens';
import { AppModule } from './app.module';
import { AppComponent } from './components/app/app.component';
import { HttpCacheInterceptor } from './services/http-cache.interceptor';
import { StateService } from './services/state.service';
import { ZoneService } from './services/zone.service';


@NgModule({
  imports: [
    AppModule,
    ServerModule,
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: HttpCacheInterceptor, multi: true },
    { provide: ZONE_SERVICE, useClass: ZoneService },
  ],
  bootstrap: [AppComponent],
})
export class AppServerModule {}