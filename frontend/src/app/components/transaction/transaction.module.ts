import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { TransactionComponent } from './transaction.component';
import { SharedModule } from '../../shared/shared.module';
import { TxBowtieModule } from '../tx-bowtie-graph/tx-bowtie.module';
import { GraphsModule } from '../../graphs/graphs.module';
import { AcceleratePreviewComponent } from '../accelerate-preview/accelerate-preview.component';
import { AccelerateCheckout } from '../accelerate-checkout/accelerate-checkout.component';
import { AccelerateFeeGraphComponent } from '../accelerate-preview/accelerate-fee-graph.component';
import { TrackerComponent } from '../tracker/tracker.component';
import { TrackerBarComponent } from '../tracker/tracker-bar.component';

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
    GraphsModule,
    TxBowtieModule,
  ],
  declarations: [
    TransactionComponent,
    TrackerComponent,
    TrackerBarComponent,
    AcceleratePreviewComponent,
    AccelerateCheckout,
    AccelerateFeeGraphComponent,
  ]
})
export class TransactionModule { }






