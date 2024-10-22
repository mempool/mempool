import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@app/shared/shared.module';
import { LightningDashboardComponent } from '@app/lightning/lightning-dashboard/lightning-dashboard.component';
import { LightningApiService } from '@app/lightning/lightning-api.service';
import { NodesListComponent } from '@app/lightning/nodes-list/nodes-list.component';
import { RouterModule } from '@angular/router';
import { NodeStatisticsComponent } from '@app/lightning/node-statistics/node-statistics.component';
import { NodeComponent } from '@app/lightning/node/node.component';
import { LightningRoutingModule } from '@app/lightning/lightning.routing.module';
import { ChannelsListComponent } from '@app/lightning/channels-list/channels-list.component';
import { ChannelComponent } from '@app/lightning/channel/channel.component';
import { LightningWrapperComponent } from '@app/lightning/lightning-wrapper/lightning-wrapper.component';
import { ChannelBoxComponent } from '@app/lightning/channel/channel-box/channel-box.component';
import { ChannelCloseBoxComponent } from '@app/lightning/channel/channel-close-box/channel-close-box.component';
import { ClosingTypeComponent } from '@app/lightning/channel/closing-type/closing-type.component';
import { LightningStatisticsChartComponent } from '@app/lightning/statistics-chart/lightning-statistics-chart.component';
import { NodeStatisticsChartComponent } from '@app/lightning/node-statistics-chart/node-statistics-chart.component';
import { NodeFeeChartComponent } from '@app/lightning/node-fee-chart/node-fee-chart.component';
import { GraphsModule } from '@app/graphs/graphs.module';
import { NodesNetworksChartComponent } from '@app/lightning/nodes-networks-chart/nodes-networks-chart.component';
import { ChannelsStatisticsComponent } from '@app/lightning/channels-statistics/channels-statistics.component';
import { NodesPerISPChartComponent } from '@app/lightning/nodes-per-isp-chart/nodes-per-isp-chart.component';
import { NodesPerCountry } from '@app/lightning/nodes-per-country/nodes-per-country.component';
import { NodesPerISP } from '@app/lightning/nodes-per-isp/nodes-per-isp.component';
import { NodesPerCountryChartComponent } from '@app/lightning/nodes-per-country-chart/nodes-per-country-chart.component';
import { NodesMap } from '@app/lightning/nodes-map/nodes-map.component';
import { NodesChannelsMap } from '@app/lightning/nodes-channels-map/nodes-channels-map.component';
import { NodesRanking } from '@app/lightning/nodes-ranking/nodes-ranking.component';
import { TopNodesPerChannels } from '@app/lightning/nodes-ranking/top-nodes-per-channels/top-nodes-per-channels.component';
import { TopNodesPerCapacity } from '@app/lightning/nodes-ranking/top-nodes-per-capacity/top-nodes-per-capacity.component';
import { JusticeList } from '@app/lightning/justice-list/justice-list.component';
import { OldestNodes } from '@app/lightning/nodes-ranking/oldest-nodes/oldest-nodes.component';
import { NodesRankingsDashboard } from '@app/lightning/nodes-rankings-dashboard/nodes-rankings-dashboard.component';
import { NodeChannels } from '@app/lightning/nodes-channels/node-channels.component';
import { GroupComponent } from '@app/lightning/group/group.component';

@NgModule({
  declarations: [
    LightningDashboardComponent,
    NodesListComponent,
    NodeStatisticsComponent,
    NodeStatisticsChartComponent,
    NodeFeeChartComponent,
    NodeComponent,
    ChannelsListComponent,
    ChannelComponent,
    LightningWrapperComponent,
    ChannelBoxComponent,
    ChannelCloseBoxComponent,
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
    JusticeList,
    OldestNodes,
    NodesRankingsDashboard,
    NodeChannels,
    GroupComponent,
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
    NodeFeeChartComponent,
    NodeComponent,
    ChannelsListComponent,
    ChannelComponent,
    LightningWrapperComponent,
    ChannelBoxComponent,
    ChannelCloseBoxComponent,
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
    JusticeList,
    OldestNodes,
    NodesRankingsDashboard,
    NodeChannels,
  ],
  providers: [
    LightningApiService,
  ]
})
export class LightningModule { }
