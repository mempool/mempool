import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NodePreviewComponent } from '@app/lightning/node/node-preview.component';
import { ChannelPreviewComponent } from '@app/lightning/channel/channel-preview.component';
import { NodesPerISPPreview } from '@app/lightning/nodes-per-isp/nodes-per-isp-preview.component';
import { GroupPreviewComponent } from '@app/lightning/group/group-preview.component';

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
      path: 'group/:slug',
      component: GroupPreviewComponent,
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
