import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LightningDashboardComponent } from './lightning-dashboard/lightning-dashboard.component';
import { LightningWrapperComponent } from './lightning-wrapper/lightning-wrapper.component';
import { NodeComponent } from './node/node.component';
import { ChannelComponent } from './channel/channel.component';
import { NodesPerCountry } from './nodes-per-country/nodes-per-country.component';
import { NodesPerISP } from './nodes-per-isp/nodes-per-isp.component';
import { NodesRanking } from './nodes-ranking/nodes-ranking.component';

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
          path: 'nodes/top-capacity',
          component: NodesRanking,
          data: {
            type: 'capacity'
          },
        },
        {
          path: 'nodes/top-channels',
          component: NodesRanking,
          data: {
            type: 'channels'
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
