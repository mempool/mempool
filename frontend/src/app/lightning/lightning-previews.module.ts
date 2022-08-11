import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../shared/shared.module';
import { RouterModule } from '@angular/router';
import { GraphsModule } from '../graphs/graphs.module';
import { LightningModule } from './lightning.module';
import { LightningApiService } from './lightning-api.service';
import { NodePreviewComponent } from './node/node-preview.component';
import { LightningPreviewsRoutingModule } from './lightning-previews.routing.module';
@NgModule({
  declarations: [
    NodePreviewComponent,
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
