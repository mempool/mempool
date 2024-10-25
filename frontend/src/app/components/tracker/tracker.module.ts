import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { SharedModule } from '@app/shared/shared.module';
import { TxBowtieModule } from '@components/tx-bowtie-graph/tx-bowtie.module';
import { GraphsModule } from '@app/graphs/graphs.module';
import { TrackerComponent } from '@components/tracker/tracker.component';
import { TrackerBarComponent } from '@components/tracker/tracker-bar.component';
import { TransactionModule } from '@components/transaction/transaction.module';

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






