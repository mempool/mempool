import { BrowserModule, BrowserTransferStateModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { NgxEchartsModule } from 'ngx-echarts';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './components/app/app.component';

import { StartComponent } from './components/start/start.component';
import { ElectrsApiService } from './services/electrs-api.service';
import { TransactionComponent } from './components/transaction/transaction.component';
import { TransactionsListComponent } from './components/transactions-list/transactions-list.component';
import { StateService } from './services/state.service';
import { BlockComponent } from './components/block/block.component';
import { AddressComponent } from './components/address/address.component';
import { SearchFormComponent } from './components/search-form/search-form.component';
import { LatestBlocksComponent } from './components/latest-blocks/latest-blocks.component';
import { WebsocketService } from './services/websocket.service';
import { AddressLabelsComponent } from './components/address-labels/address-labels.component';
import { MasterPageComponent } from './components/master-page/master-page.component';
import { BisqMasterPageComponent } from './components/bisq-master-page/bisq-master-page.component';
import { LiquidMasterPageComponent } from './components/liquid-master-page/liquid-master-page.component';
import { AboutComponent } from './components/about/about.component';
import { TelevisionComponent } from './components/television/television.component';
import { StatisticsComponent } from './components/statistics/statistics.component';
import { FooterComponent } from './components/footer/footer.component';
import { AudioService } from './services/audio.service';
import { MempoolBlockComponent } from './components/mempool-block/mempool-block.component';
import { FeeDistributionGraphComponent } from './components/fee-distribution-graph/fee-distribution-graph.component';
import { IncomingTransactionsGraphComponent } from './components/incoming-transactions-graph/incoming-transactions-graph.component';
import { TimeSpanComponent } from './components/time-span/time-span.component';
import { SeoService } from './services/seo.service';
import { MempoolGraphComponent } from './components/mempool-graph/mempool-graph.component';
import { PoolRankingComponent } from './components/pool-ranking/pool-ranking.component';
import { PoolComponent } from './components/pool/pool.component';
import { LbtcPegsGraphComponent } from './components/lbtc-pegs-graph/lbtc-pegs-graph.component';
import { AssetComponent } from './components/asset/asset.component';
import { AssetsComponent } from './components/assets/assets.component';
import { AssetsNavComponent } from './components/assets/assets-nav/assets-nav.component';
import { StatusViewComponent } from './components/status-view/status-view.component';
import { SharedModule } from './shared/shared.module';
import { NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { FeesBoxComponent } from './components/fees-box/fees-box.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { DifficultyComponent } from './components/difficulty/difficulty.component';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faFilter, faAngleDown, faAngleUp, faAngleRight, faAngleLeft, faBolt, faChartArea, faCogs, faCubes, faHammer, faDatabase, faExchangeAlt, faInfoCircle,
  faLink, faList, faSearch, faCaretUp, faCaretDown, faTachometerAlt, faThList, faTint, faTv, faAngleDoubleDown, faSortUp, faAngleDoubleUp, faChevronDown,
  faFileAlt, faRedoAlt, faArrowAltCircleRight, faExternalLinkAlt, faBook, faListUl, faDownload } from '@fortawesome/free-solid-svg-icons';
import { TermsOfServiceComponent } from './components/terms-of-service/terms-of-service.component';
import { PrivacyPolicyComponent } from './components/privacy-policy/privacy-policy.component';
import { TrademarkPolicyComponent } from './components/trademark-policy/trademark-policy.component';
import { StorageService } from './services/storage.service';
import { HttpCacheInterceptor } from './services/http-cache.interceptor';
import { LanguageService } from './services/language.service';
import { SponsorComponent } from './components/sponsor/sponsor.component';
import { PushTransactionComponent } from './components/push-transaction/push-transaction.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { AssetsFeaturedComponent } from './components/assets/assets-featured/assets-featured.component';
import { AssetGroupComponent } from './components/assets/asset-group/asset-group.component';
import { AssetCirculationComponent } from './components/asset-circulation/asset-circulation.component';
import { MiningDashboardComponent } from './components/mining-dashboard/mining-dashboard.component';
import { HashrateChartComponent } from './components/hashrate-chart/hashrate-chart.component';
import { HashrateChartPoolsComponent } from './components/hashrates-chart-pools/hashrate-chart-pools.component';
import { MiningStartComponent } from './components/mining-start/mining-start.component';
import { AmountShortenerPipe } from './shared/pipes/amount-shortener.pipe';
import { ShortenStringPipe } from './shared/pipes/shorten-string-pipe/shorten-string.pipe';
import { GraphsComponent } from './components/graphs/graphs.component';
import { DifficultyAdjustmentsTable } from './components/difficulty-adjustments-table/difficulty-adjustments-table.components';
import { BlocksList } from './components/blocks-list/blocks-list.component';
import { RewardStatsComponent } from './components/reward-stats/reward-stats.component';
import { DataCyDirective } from './data-cy.directive';
import { BlockFeesGraphComponent } from './components/block-fees-graph/block-fees-graph.component';
import { BlockRewardsGraphComponent } from './components/block-rewards-graph/block-rewards-graph.component';
import { BlockFeeRatesGraphComponent } from './components/block-fee-rates-graph/block-fee-rates-graph.component';
import { LoadingIndicatorComponent } from './components/loading-indicator/loading-indicator.component';
import { IndexingProgressComponent } from './components/indexing-progress/indexing-progress.component';
import { BlockSizesWeightsGraphComponent } from './components/block-sizes-weights-graph/block-sizes-weights-graph.component';

@NgModule({
  declarations: [
    AppComponent,
    AboutComponent,
    MasterPageComponent,
    BisqMasterPageComponent,
    LiquidMasterPageComponent,
    TelevisionComponent,
    StartComponent,
    StatisticsComponent,
    TransactionComponent,
    BlockComponent,
    TransactionsListComponent,
    AddressComponent,
    LatestBlocksComponent,
    SearchFormComponent,
    TimeSpanComponent,
    AddressLabelsComponent,
    FooterComponent,
    MempoolBlockComponent,
    FeeDistributionGraphComponent,
    IncomingTransactionsGraphComponent,
    MempoolGraphComponent,
    PoolRankingComponent,
    PoolComponent,
    LbtcPegsGraphComponent,
    AssetComponent,
    AssetsComponent,
    StatusViewComponent,
    FeesBoxComponent,
    DashboardComponent,
    DifficultyComponent,
    TermsOfServiceComponent,
    PrivacyPolicyComponent,
    TrademarkPolicyComponent,
    SponsorComponent,
    PushTransactionComponent,
    AssetsNavComponent,
    AssetsFeaturedComponent,
    AssetGroupComponent,
    AssetCirculationComponent,
    MiningDashboardComponent,
    HashrateChartComponent,
    HashrateChartPoolsComponent,
    MiningStartComponent,
    AmountShortenerPipe,
    GraphsComponent,
    DifficultyAdjustmentsTable,
    BlocksList,
    DataCyDirective,
    RewardStatsComponent,
    BlockFeesGraphComponent,
    BlockRewardsGraphComponent,
    BlockFeeRatesGraphComponent,
    LoadingIndicatorComponent,
    IndexingProgressComponent,
    BlockSizesWeightsGraphComponent
  ],
  imports: [
    BrowserModule.withServerTransition({ appId: 'serverApp' }),
    BrowserTransferStateModule,
    AppRoutingModule,
    HttpClientModule,
    BrowserAnimationsModule,
    InfiniteScrollModule,
    NgbTypeaheadModule,
    NgbModule,
    FontAwesomeModule,
    SharedModule,
    NgxEchartsModule.forRoot({
      echarts: () => import('echarts')
    })
  ],
  providers: [
    ElectrsApiService,
    StateService,
    WebsocketService,
    AudioService,
    SeoService,
    StorageService,
    LanguageService,
    ShortenStringPipe,
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
    library.addIcons(faHammer);
    library.addIcons(faCogs);
    library.addIcons(faThList);
    library.addIcons(faList);
    library.addIcons(faTachometerAlt);
    library.addIcons(faDatabase);
    library.addIcons(faSearch);
    library.addIcons(faLink);
    library.addIcons(faBolt);
    library.addIcons(faTint);
    library.addIcons(faFilter);
    library.addIcons(faAngleDown);
    library.addIcons(faAngleUp);
    library.addIcons(faExchangeAlt);
    library.addIcons(faAngleDoubleUp);
    library.addIcons(faAngleDoubleDown);
    library.addIcons(faChevronDown);
    library.addIcons(faFileAlt);
    library.addIcons(faRedoAlt);
    library.addIcons(faArrowAltCircleRight);
    library.addIcons(faExternalLinkAlt);
    library.addIcons(faSortUp);
    library.addIcons(faCaretUp);
    library.addIcons(faCaretDown);
    library.addIcons(faAngleRight);
    library.addIcons(faAngleLeft);
    library.addIcons(faBook);
    library.addIcons(faListUl);
    library.addIcons(faDownload);
  }
}
