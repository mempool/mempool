import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LightningDashboardComponent } from '@app/lightning/lightning-dashboard/lightning-dashboard.component';
import { LightningWrapperComponent } from '@app/lightning/lightning-wrapper/lightning-wrapper.component';
import { NodeComponent } from '@app/lightning/node/node.component';
import { ChannelComponent } from '@app/lightning/channel/channel.component';
import { NodesPerCountry } from '@app/lightning/nodes-per-country/nodes-per-country.component';
import { NodesPerISP } from '@app/lightning/nodes-per-isp/nodes-per-isp.component';
import { NodesRanking } from '@app/lightning/nodes-ranking/nodes-ranking.component';
import { NodesRankingsDashboard } from '@app/lightning/nodes-rankings-dashboard/nodes-rankings-dashboard.component';
import { GroupComponent } from '@app/lightning/group/group.component';
import { JusticeList } from '@app/lightning/justice-list/justice-list.component';

const routes: Routes = [
    {
      path: '',
      component: LightningWrapperComponent,
      children: [
        {
          path: '',
          component: LightningDashboardComponent,
        },
        {
          path: 'node/:public_key',
          data: { networkSpecific: true },
          component: NodeComponent,
        },
        {
          path: 'channel/:short_id',
          data: { networkSpecific: true },
          component: ChannelComponent,
        },
        {
          path: 'nodes/country/:country',
          component: NodesPerCountry,
        },
        {
          path: 'nodes/isp/:isp',
          component: NodesPerISP,
        },
        {
          path: 'group/the-mempool-open-source-project',
          component: GroupComponent,
        },
        {
          path: 'nodes/rankings',
          component: NodesRankingsDashboard,
        },
        {
          path: 'nodes/rankings/liquidity',
          component: NodesRanking,
          data: {
            type: 'capacity'
          },
        },
        {
          path: 'nodes/rankings/connectivity',
          component: NodesRanking,
          data: {
            type: 'channels'
          },
        },
        {
          path: 'nodes/oldest',
          component: NodesRanking,
          data: {
            type: 'oldest'
          },
        },
        {
          path: 'penalties',
          component: JusticeList,
        },
        {
          path: '**',
          redirectTo: ''
        }
      ]
    },
    {
      path: '**',
      redirectTo: ''
    }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LightningRoutingModule { }
