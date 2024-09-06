import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { TransactionComponent } from './transaction.component';
import { SharedModule } from '../../shared/shared.module';
import { TxBowtieModule } from '../tx-bowtie-graph/tx-bowtie.module';
import { GraphsModule } from '../../graphs/graphs.module';
import { AccelerateCheckout } from '../accelerate-checkout/accelerate-checkout.component';
import { AccelerateFeeGraphComponent } from '../accelerate-checkout/accelerate-fee-graph.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: '/',
    pathMatch: 'full',
  },
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
    GraphsModule,
    TxBowtieModule,
  ],
  declarations: [
    TransactionComponent,
    AccelerateCheckout,
    AccelerateFeeGraphComponent,
  ],
  exports: [
    TransactionComponent,
    AccelerateCheckout,
    AccelerateFeeGraphComponent,
  ]
})
export class TransactionModule { }






