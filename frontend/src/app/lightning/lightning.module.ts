import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../shared/shared.module';
import { LightningDashboardComponent } from './lightning-dashboard/lightning-dashboard.component';
import { LightningApiService } from './lightning-api.service';
import { NodesListComponent } from './nodes-list/nodes-list.component';
import { RouterModule } from '@angular/router';
import { NodeStatisticsComponent } from './node-statistics/node-statistics.component';
import { NodeComponent } from './node/node.component';
import { LightningRoutingModule } from './lightning.routing.module';
import { ChannelsListComponent } from './channels-list/channels-list.component';
import { ChannelComponent } from './channel/channel.component';
import { LightningWrapperComponent } from './lightning-wrapper/lightning-wrapper.component';
@NgModule({
  declarations: [
    LightningDashboardComponent,
    NodesListComponent,
    NodeStatisticsComponent,
    NodeComponent,
    ChannelsListComponent,
    ChannelComponent,
    LightningWrapperComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    RouterModule,
    LightningRoutingModule,
  ],
  providers: [
    LightningApiService,
  ]
})
export class LightningModule { }
