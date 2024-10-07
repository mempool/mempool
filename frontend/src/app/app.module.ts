import { BrowserModule } from '@angular/platform-browser';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ZONE_SERVICE } from './injection-tokens';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './components/app/app.component';
import { ElectrsApiService } from './services/electrs-api.service';
import { OrdApiService } from './services/ord-api.service';
import { StateService } from './services/state.service';
import { CacheService } from './services/cache.service';
import { PriceService } from './services/price.service';
import { EnterpriseService } from './services/enterprise.service';
import { WebsocketService } from './services/websocket.service';
import { AudioService } from './services/audio.service';
import { PreloadService } from './services/preload.service';
import { SeoService } from './services/seo.service';
import { OpenGraphService } from './services/opengraph.service';
import { ZoneService } from './services/zone-shim.service';
import { SharedModule } from './shared/shared.module';
import { StorageService } from './services/storage.service';
import { HttpCacheInterceptor } from './services/http-cache.interceptor';
import { LanguageService } from './services/language.service';
import { ThemeService } from './services/theme.service';
import { TimeService } from './services/time.service';
import { FiatShortenerPipe } from './shared/pipes/fiat-shortener.pipe';
import { FiatCurrencyPipe } from './shared/pipes/fiat-currency.pipe';
import { ShortenStringPipe } from './shared/pipes/shorten-string-pipe/shorten-string.pipe';
import { CapAddressPipe } from './shared/pipes/cap-address-pipe/cap-address-pipe';
import { AppPreloadingStrategy } from './app.preloading-strategy';
import { ServicesApiServices } from './services/services-api.service';
import { DatePipe } from '@angular/common';

const providers = [
  ElectrsApiService,
  OrdApiService,
  StateService,
  CacheService,
  PriceService,
  WebsocketService,
  AudioService,
  SeoService,
  OpenGraphService,
  StorageService,
  EnterpriseService,
  LanguageService,
  ThemeService,
  TimeService,
  ShortenStringPipe,
  FiatShortenerPipe,
  FiatCurrencyPipe,
  CapAddressPipe,
  DatePipe,
  AppPreloadingStrategy,
  ServicesApiServices,
  PreloadService,
  { provide: HTTP_INTERCEPTORS, useClass: HttpCacheInterceptor, multi: true },
  { provide: ZONE_SERVICE, useClass: ZoneService },
];

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    BrowserAnimationsModule,
    SharedModule,
  ],
  providers: providers,
  bootstrap: [AppComponent]
})
export class AppModule { }

@NgModule({})
export class MempoolSharedModule{
  static forRoot(): ModuleWithProviders<MempoolSharedModule> {
    return {
      ngModule: AppModule,
      providers: providers
    };
  }
}
