import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LightningDashboardComponent } from './lightning-dashboard/lightning-dashboard.component';
import { LightningWrapperComponent } from './lightning-wrapper/lightning-wrapper.component';
import { NodeComponent } from './node/node.component';
import { ChannelComponent } from './channel/channel.component';
import { NodesPerCountry } from './nodes-per-country/nodes-per-country.component';
import { NodesPerISP } from './nodes-per-isp/nodes-per-isp.component';
import { NodesRanking } from './nodes-ranking/nodes-ranking.component';
import { NodesRankingsDashboard } from './nodes-rankings-dashboard/nodes-rankings-dashboard.component';
import { GroupComponent } from './group/group.component';

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
          component: NodeComponent,
        },
        {
          path: 'channel/:short_id',
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
