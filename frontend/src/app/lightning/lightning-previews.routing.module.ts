import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NodePreviewComponent } from './node/node-preview.component';
import { ChannelPreviewComponent } from './channel/channel-preview.component';
import { NodesPerISPPreview } from './nodes-per-isp/nodes-per-isp-preview.component';

const routes: Routes = [
    {
      path: 'node/:public_key',
      component: NodePreviewComponent,
    },
    {
      path: 'channel/:short_id',
      component: ChannelPreviewComponent,
    },
    {
      path: 'nodes/isp/:isp',
      component: NodesPerISPPreview,
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
export class LightningPreviewsRoutingModule { }
