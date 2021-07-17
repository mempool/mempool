import { BrowserModule, BrowserTransferStateModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './components/app/app.component';

import { StartComponent } from './components/start/start.component';
import { ElectrsApiService } from './services/electrs-api.service';
import { TransactionComponent } from './components/transaction/transaction.component';
import { TransactionsListComponent } from './components/transactions-list/transactions-list.component';
import { AmountComponent } from './components/amount/amount.component';
import { StateService } from './services/state.service';
import { BlockComponent } from './components/block/block.component';
import { AddressComponent } from './components/address/address.component';
import { SearchFormComponent } from './components/search-form/search-form.component';
import { LatestBlocksComponent } from './components/latest-blocks/latest-blocks.component';
import { WebsocketService } from './services/websocket.service';
import { AddressLabelsComponent } from './components/address-labels/address-labels.component';
import { MempoolBlocksComponent } from './components/mempool-blocks/mempool-blocks.component';
import { MasterPageComponent } from './components/master-page/master-page.component';
import { BisqMasterPageComponent } from './components/bisq-master-page/bisq-master-page.component';
import { AboutComponent } from './components/about/about.component';
import { TelevisionComponent } from './components/television/television.component';
import { StatisticsComponent } from './components/statistics/statistics.component';
import { ChartistComponent } from './components/statistics/chartist.component';
import { BlockchainBlocksComponent } from './components/blockchain-blocks/blockchain-blocks.component';
import { BlockchainComponent } from './components/blockchain/blockchain.component';
import { FooterComponent } from './components/footer/footer.component';
import { AudioService } from './services/audio.service';
import { MempoolBlockComponent } from './components/mempool-block/mempool-block.component';
import { FeeDistributionGraphComponent } from './components/fee-distribution-graph/fee-distribution-graph.component';
import { TimeSpanComponent } from './components/time-span/time-span.component';
import { SeoService } from './services/seo.service';
import { MempoolGraphComponent } from './components/mempool-graph/mempool-graph.component';
import { AssetComponent } from './components/asset/asset.component';
import { AssetsComponent } from './assets/assets.component';
import { StatusViewComponent } from './components/status-view/status-view.component';
import { MinerComponent } from './components/miner/miner.component';
import { SharedModule } from './shared/shared.module';
import { NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { FeesBoxComponent } from './components/fees-box/fees-box.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faAngleDown, faAngleUp, faBolt, faChartArea, faCogs, faCubes, faDatabase, faExchangeAlt, faInfoCircle,
  faLink, faList, faSearch, faTachometerAlt, faThList, faTint, faTv, faAngleDoubleDown, faAngleDoubleUp, faChevronDown, faFileAlt, faRedoAlt, faArrowAltCircleRight } from '@fortawesome/free-solid-svg-icons';
import { ApiDocsComponent } from './components/api-docs/api-docs.component';
import { CodeTemplateComponent } from './components/api-docs/code-template.component';
import { TermsOfServiceComponent } from './components/terms-of-service/terms-of-service.component';
import { StorageService } from './services/storage.service';
import { HttpCacheInterceptor } from './services/http-cache.interceptor';
import { SponsorComponent } from './components/sponsor/sponsor.component';

@NgModule({
  declarations: [
    AppComponent,
    AboutComponent,
    MasterPageComponent,
    BisqMasterPageComponent,
    TelevisionComponent,
    BlockchainComponent,
    StartComponent,
    BlockchainBlocksComponent,
    StatisticsComponent,
    TransactionComponent,
    BlockComponent,
    TransactionsListComponent,
    AddressComponent,
    AmountComponent,
    LatestBlocksComponent,
    SearchFormComponent,
    TimeSpanComponent,
    AddressLabelsComponent,
    MempoolBlocksComponent,
    ChartistComponent,
    FooterComponent,
    MempoolBlockComponent,
    FeeDistributionGraphComponent,
    MempoolGraphComponent,
    AssetComponent,
    AssetsComponent,
    MinerComponent,
    StatusViewComponent,
    FeesBoxComponent,
    DashboardComponent,
    ApiDocsComponent,
    CodeTemplateComponent,
    TermsOfServiceComponent,
    SponsorComponent,
  ],
  imports: [
    BrowserModule.withServerTransition({ appId: 'serverApp' }),
    BrowserTransferStateModule,
    AppRoutingModule,
    HttpClientModule,
    BrowserAnimationsModule,
    InfiniteScrollModule,
    NgbTypeaheadModule,
    FontAwesomeModule,
    SharedModule,
  ],
  providers: [
    ElectrsApiService,
    StateService,
    WebsocketService,
    AudioService,
    SeoService,
    StorageService,
    { provide: HTTP_INTERCEPTORS, useClass: HttpCacheInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(library: FaIconLibrary) {
    library.addIcons(faInfoCircle);
    library.addIcons(faChartArea);
    library.addIcons(faTv);
    library.addIcons(faTachometerAlt);
    library.addIcons(faCubes);
    library.addIcons(faCogs);
    library.addIcons(faThList);
    library.addIcons(faList);
    library.addIcons(faTachometerAlt);
    library.addIcons(faDatabase);
    library.addIcons(faSearch);
    library.addIcons(faLink);
    library.addIcons(faBolt);
    library.addIcons(faTint);
    library.addIcons(faAngleDown);
    library.addIcons(faAngleUp);
    library.addIcons(faExchangeAlt);
    library.addIcons(faAngleDoubleUp);
    library.addIcons(faAngleDoubleDown);
    library.addIcons(faChevronDown);
    library.addIcons(faFileAlt);
    library.addIcons(faRedoAlt);
    library.addIcons(faArrowAltCircleRight);
  }
}
