import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { BlockComponent } from '@components/block/block.component';
import { BlockTransactionsComponent } from '@components/block/block-transactions.component';
import { SharedModule } from '@app/shared/shared.module';

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
    BlockTransactionsComponent,
  ]
})
export class BlockModule { }






