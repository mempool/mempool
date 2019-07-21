import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { BlockchainComponent } from './blockchain/blockchain.component';
import { AppRoutingModule } from './app-routing.module';
import { SharedModule } from './shared/shared.module';
import { MemPoolService } from './services/mem-pool.service';
import { HttpClientModule } from '@angular/common/http';
import { FooterComponent } from './footer/footer.component';
import { AboutComponent } from './about/about.component';
import { TxBubbleComponent } from './tx-bubble/tx-bubble.component';
import { ReactiveFormsModule } from '@angular/forms';
import { BlockModalComponent } from './block-modal/block-modal.component';
import { StatisticsComponent } from './statistics/statistics.component';
import { ProjectedBlockModalComponent } from './projected-block-modal/projected-block-modal.component';

@NgModule({
  declarations: [
    AppComponent,
    BlockchainComponent,
    FooterComponent,
    StatisticsComponent,
    AboutComponent,
    TxBubbleComponent,
    BlockModalComponent,
    ProjectedBlockModalComponent,
  ],
  imports: [
    ReactiveFormsModule,
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    SharedModule,
  ],
  providers: [
    MemPoolService,
  ],
  entryComponents: [
    BlockModalComponent,
    ProjectedBlockModalComponent,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
