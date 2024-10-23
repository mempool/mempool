import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@app/shared/shared.module';
import { RouterModule } from '@angular/router';
import { GraphsModule } from '@app/graphs/graphs.module';
import { LightningModule } from '@app/lightning/lightning.module';
import { LightningApiService } from '@app/lightning/lightning-api.service';
import { NodePreviewComponent } from '@app/lightning/node/node-preview.component';
import { LightningPreviewsRoutingModule } from '@app/lightning/lightning-previews.routing.module';
import { ChannelPreviewComponent } from '@app/lightning/channel/channel-preview.component';
import { NodesPerISPPreview } from '@app/lightning/nodes-per-isp/nodes-per-isp-preview.component';
import { GroupPreviewComponent } from '@app/lightning/group/group-preview.component';
@NgModule({
  declarations: [
    NodePreviewComponent,
    ChannelPreviewComponent,
    NodesPerISPPreview,
    GroupPreviewComponent,
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
