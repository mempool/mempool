import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { MasterPageComponent } from './components/master-page/master-page.component';

const routes: Routes = [
  {
    path: '',
    component: MasterPageComponent,
    loadChildren: () => import('./graphs/graphs.module').then(m => m.GraphsModule)
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
export class BitcoinGraphsRoutingModule { }

@NgModule({
  imports: [
    CommonModule,
    BitcoinGraphsRoutingModule,
  ],
})
export class BitcoinGraphsModule { }






