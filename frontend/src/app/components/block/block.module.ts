import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { BlockComponent } from './block.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  {
    path: ':id',
    component: BlockComponent,
    data: {
      ogImage: true
    }
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
export class BlockRoutingModule { }

@NgModule({
  imports: [
    CommonModule,
    BlockRoutingModule,
    SharedModule,
  ],
  declarations: [
    BlockComponent,
  ]
})
export class BlockModule { }






