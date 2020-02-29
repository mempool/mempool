import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgbButtonsModule } from '@ng-bootstrap/ng-bootstrap';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './components/app/app.component';

import { StartComponent } from './components/start/start.component';
import { ElectrsApiService } from './services/electrs-api.service';
import { BytesPipe } from './pipes/bytes-pipe/bytes.pipe';
import { VbytesPipe } from './pipes/bytes-pipe/vbytes.pipe';
import { WuBytesPipe } from './pipes/bytes-pipe/wubytes.pipe';
import { TransactionComponent } from './components/transaction/transaction.component';
import { TransactionsListComponent } from './components/transactions-list/transactions-list.component';
import { AmountComponent } from './components/amount/amount.component';
import { StateService } from './services/state.service';
import { BlockComponent } from './components/block/block.component';
import { ShortenStringPipe } from './pipes/shorten-string-pipe/shorten-string.pipe';
import { AddressComponent } from './components/address/address.component';
import { SearchFormComponent } from './components/search-form/search-form.component';
import { LatestBlocksComponent } from './components/latest-blocks/latest-blocks.component';
import { WebsocketService } from './services/websocket.service';
import { TimeSinceComponent } from './components/time-since/time-since.component';
import { AddressLabelsComponent } from './components/address-labels/address-labels.component';
import { MempoolBlocksComponent } from './components/mempool-blocks/mempool-blocks.component';
import { CeilPipe } from './pipes/math-ceil/math-ceil.pipe';
import { LatestTransactionsComponent } from './components/latest-transactions/latest-transactions.component';
import { QrcodeComponent } from './components/qrcode/qrcode.component';
import { ClipboardComponent } from './components/clipboard/clipboard.component';
import { MasterPageComponent } from './components/master-page/master-page.component';
import { AboutComponent } from './components/about/about.component';
import { TelevisionComponent } from './components/television/television.component';
import { StatisticsComponent } from './components/statistics/statistics.component';
import { ChartistComponent } from './components/statistics/chartist.component';
import { BlockchainBlocksComponent } from './components/blockchain-blocks/blockchain-blocks.component';
import { BlockchainComponent } from './components/blockchain/blockchain.component';
import { FooterComponent } from './components/footer/footer.component';
import { ExplorerComponent } from './components/explorer/explorer.component';
import { AudioService } from './services/audio.service';

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
    BytesPipe,
    VbytesPipe,
    WuBytesPipe,
    CeilPipe,
    ShortenStringPipe,
    AddressComponent,
    AmountComponent,
    SearchFormComponent,
    LatestBlocksComponent,
    TimeSinceComponent,
    AddressLabelsComponent,
    MempoolBlocksComponent,
    LatestTransactionsComponent,
    QrcodeComponent,
    ClipboardComponent,
    ExplorerComponent,
    ChartistComponent,
    FooterComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    ReactiveFormsModule,
    BrowserAnimationsModule,
    NgbButtonsModule,
    InfiniteScrollModule,
  ],
  providers: [
    ElectrsApiService,
    StateService,
    WebsocketService,
    VbytesPipe,
    AudioService,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
