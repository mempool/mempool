import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@app/shared/shared.module';
import { TxBowtieGraphComponent } from '@components/tx-bowtie-graph/tx-bowtie-graph.component';
import { TxBowtieGraphTooltipComponent } from '@components/tx-bowtie-graph-tooltip/tx-bowtie-graph-tooltip.component';


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






