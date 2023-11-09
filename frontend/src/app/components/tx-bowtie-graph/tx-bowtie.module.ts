import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../shared/shared.module';
import { TxBowtieGraphComponent } from '../tx-bowtie-graph/tx-bowtie-graph.component';
import { TxBowtieGraphTooltipComponent } from '../tx-bowtie-graph-tooltip/tx-bowtie-graph-tooltip.component';


@NgModule({
  imports: [
    CommonModule,
    SharedModule,
  ],
  declarations: [
    TxBowtieGraphComponent,
    TxBowtieGraphTooltipComponent,
  ],
  exports: [
    TxBowtieGraphComponent,
    TxBowtieGraphTooltipComponent,
  ]
})
export class TxBowtieModule { }






