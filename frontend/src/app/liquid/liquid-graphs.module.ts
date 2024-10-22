import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { LiquidMasterPageComponent } from '@components/liquid-master-page/liquid-master-page.component';

const routes: Routes = [
  {
    path: '',
    component: LiquidMasterPageComponent,
    loadChildren: () => import('../graphs/graphs.module').then(m => m.GraphsModule),
    data: { preload: true },
  }
];

@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ],
  exports: [
    RouterModule
  ]
})
export class LiquidGraphsRoutingModule { }

@NgModule({
  imports: [
    CommonModule,
    LiquidGraphsRoutingModule,
  ],
})
export class LiquidGraphsModule { }






