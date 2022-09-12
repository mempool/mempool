import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../shared/shared.module';
import { RouterModule } from '@angular/router';
import { GraphsModule } from '../graphs/graphs.module';
import { LightningModule } from './lightning.module';
import { LightningApiService } from './lightning-api.service';
import { NodePreviewComponent } from './node/node-preview.component';
import { LightningPreviewsRoutingModule } from './lightning-previews.routing.module';
import { ChannelPreviewComponent } from './channel/channel-preview.component';
import { NodesPerISPPreview } from './nodes-per-isp/nodes-per-isp-preview.component';
@NgModule({
  declarations: [
    NodePreviewComponent,
    ChannelPreviewComponent,
    NodesPerISPPreview,
  ],
  imports: [
    CommonModule,
    SharedModule,
    RouterModule,
    GraphsModule,
    LightningPreviewsRoutingModule,
    LightningModule,
  ],
  providers: [
    LightningApiService,
  ]
})
export class LightningPreviewsModule { }
