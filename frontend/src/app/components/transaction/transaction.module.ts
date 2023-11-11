import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { TransactionComponent } from './transaction.component';
import { SharedModule } from '../../shared/shared.module';
import { TxBowtieModule } from '../tx-bowtie-graph/tx-bowtie.module';

const routes: Routes = [
  {
    path: ':id',
    component: TransactionComponent,
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
export class TransactionRoutingModule { }

@NgModule({
  imports: [
    CommonModule,
    TransactionRoutingModule,
    SharedModule,
    TxBowtieModule,
  ],
  declarations: [
    TransactionComponent,
  ]
})
export class TransactionModule { }






