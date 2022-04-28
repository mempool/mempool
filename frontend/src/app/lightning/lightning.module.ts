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
@NgModule({
  declarations: [
    LightningDashboardComponent,
    NodesListComponent,
    NodeStatisticsComponent,
    NodeComponent,
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
