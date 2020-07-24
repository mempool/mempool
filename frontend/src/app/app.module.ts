import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
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
import { TimespanComponent } from './components/timespan/timespan.component';
import { SeoService } from './services/seo.service';
import { MempoolGraphComponent } from './components/mempool-graph/mempool-graph.component';
import { AssetComponent } from './components/asset/asset.component';
import { AssetsComponent } from './assets/assets.component';
import { StatusViewComponent } from './components/status-view/status-view.component';
import { MinerComponent } from './components/miner/miner.component';
import { SharedModule } from './shared/shared.module';
import { NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';

@NgModule({
  declarations: [
    AppComponent,
    AboutComponent,
    MasterPageComponent,
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
    SearchFormComponent,
    LatestBlocksComponent,
    TimespanComponent,
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
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    BrowserAnimationsModule,
    InfiniteScrollModule,
    NgbTypeaheadModule,
    SharedModule,
  ],
  providers: [
    ElectrsApiService,
    StateService,
    WebsocketService,
    AudioService,
    SeoService,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
