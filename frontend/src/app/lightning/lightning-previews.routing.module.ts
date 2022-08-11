import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NodePreviewComponent } from './node/node-preview.component';

const routes: Routes = [
    {
      path: 'node/:public_key',
      component: NodePreviewComponent,
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
