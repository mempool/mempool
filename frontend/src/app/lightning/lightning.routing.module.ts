import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LightningDashboardComponent } from './lightning-dashboard/lightning-dashboard.component';
import { LightningWrapperComponent } from './lightning-wrapper/lightning-wrapper.component';
import { NodeComponent } from './node/node.component';
import { ChannelComponent } from './channel/channel.component';

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
