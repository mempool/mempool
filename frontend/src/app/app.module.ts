import { BrowserModule, BrowserTransferStateModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './components/app/app.component';
import { ElectrsApiService } from './services/electrs-api.service';
import { StateService } from './services/state.service';
import { EnterpriseService } from './services/enterprise.service';
import { WebsocketService } from './services/websocket.service';
import { AudioService } from './services/audio.service';
import { SeoService } from './services/seo.service';
import { OpenGraphService } from './services/opengraph.service';
import { SharedModule } from './shared/shared.module';
import { StorageService } from './services/storage.service';
import { HttpCacheInterceptor } from './services/http-cache.interceptor';
import { LanguageService } from './services/language.service';
import { FiatShortenerPipe } from './shared/pipes/fiat-shortener.pipe';
import { ShortenStringPipe } from './shared/pipes/shorten-string-pipe/shorten-string.pipe';
import { CapAddressPipe } from './shared/pipes/cap-address-pipe/cap-address-pipe';
import { AppPreloadingStrategy } from './app.preloading-strategy';

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule.withServerTransition({ appId: 'serverApp' }),
    BrowserTransferStateModule,
    AppRoutingModule,
    HttpClientModule,
    BrowserAnimationsModule,
    SharedModule,
  ],
  providers: [
    ElectrsApiService,
    StateService,
    WebsocketService,
    AudioService,
    SeoService,
    OpenGraphService,
    StorageService,
    EnterpriseService,
    LanguageService,
    ShortenStringPipe,
    FiatShortenerPipe,
    CapAddressPipe,
    AppPreloadingStrategy,
    { provide: HTTP_INTERCEPTORS, useClass: HttpCacheInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
