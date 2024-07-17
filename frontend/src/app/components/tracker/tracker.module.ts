import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { TxBowtieModule } from '../tx-bowtie-graph/tx-bowtie.module';
import { GraphsModule } from '../../graphs/graphs.module';
import { TrackerComponent } from '../tracker/tracker.component';
import { TrackerBarComponent } from '../tracker/tracker-bar.component';
import { TransactionModule } from '../transaction/transaction.module';

const routes: Routes = [
  {
    path: ':id',
    component: TrackerComponent,
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
export class TrackerRoutingModule { }

@NgModule({
  imports: [
    CommonModule,
    TrackerRoutingModule,
    TransactionModule,
    SharedModule,
    GraphsModule,
    TxBowtieModule,
  ],
  declarations: [
    TrackerComponent,
    TrackerBarComponent,
  ]
})
export class TrackerModule { }






