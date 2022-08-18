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
import { ChannelBoxComponent } from './channel/channel-box/channel-box.component';
import { ClosingTypeComponent } from './channel/closing-type/closing-type.component';
import { LightningStatisticsChartComponent } from './statistics-chart/lightning-statistics-chart.component';
import { NodeStatisticsChartComponent } from './node-statistics-chart/node-statistics-chart.component';
import { GraphsModule } from '../graphs/graphs.module';
import { NodesNetworksChartComponent } from './nodes-networks-chart/nodes-networks-chart.component';
import { ChannelsStatisticsComponent } from './channels-statistics/channels-statistics.component';
import { NodesPerISPChartComponent } from './nodes-per-isp-chart/nodes-per-isp-chart.component';
import { NodesPerCountry } from './nodes-per-country/nodes-per-country.component';
import { NodesPerISP } from './nodes-per-isp/nodes-per-isp.component';
import { NodesPerCountryChartComponent } from '../lightning/nodes-per-country-chart/nodes-per-country-chart.component';
import { NodesMap } from '../lightning/nodes-map/nodes-map.component';
import { NodesChannelsMap } from '../lightning/nodes-channels-map/nodes-channels-map.component';
import { NodesRanking } from '../lightning/nodes-ranking/nodes-ranking.component';
import { TopNodesPerChannels } from '../lightning/nodes-ranking/top-nodes-per-channels/top-nodes-per-channels.component';
import { TopNodesPerCapacity } from '../lightning/nodes-ranking/top-nodes-per-capacity/top-nodes-per-capacity.component';
@NgModule({
  declarations: [
    LightningDashboardComponent,
    NodesListComponent,
    NodeStatisticsComponent,
    NodeStatisticsChartComponent,
    NodeComponent,
    ChannelsListComponent,
    ChannelComponent,
    LightningWrapperComponent,
    ChannelBoxComponent,
    ClosingTypeComponent,
    LightningStatisticsChartComponent,
    NodesNetworksChartComponent,
    ChannelsStatisticsComponent,
    NodesPerISPChartComponent,
    NodesPerCountry,
    NodesPerISP,
    NodesPerCountryChartComponent,
    NodesMap,
    NodesChannelsMap,
    NodesRanking,
    TopNodesPerChannels,
    TopNodesPerCapacity,
  ],
  imports: [
    CommonModule,
    SharedModule,
    RouterModule,
    LightningRoutingModule,
    GraphsModule,
  ],
  exports: [
    LightningDashboardComponent,
    NodesListComponent,
    NodeStatisticsComponent,
    NodeStatisticsChartComponent,
    NodeComponent,
    ChannelsListComponent,
    ChannelComponent,
    LightningWrapperComponent,
    ChannelBoxComponent,
    ClosingTypeComponent,
    LightningStatisticsChartComponent,
    NodesNetworksChartComponent,
    ChannelsStatisticsComponent,
    NodesPerISPChartComponent,
    NodesPerCountry,
    NodesPerISP,
    NodesPerCountryChartComponent,
    NodesMap,
    NodesChannelsMap,
    NodesRanking,
    TopNodesPerChannels,
    TopNodesPerCapacity,
  ],
  providers: [
    LightningApiService,
  ]
})
export class LightningModule { }
