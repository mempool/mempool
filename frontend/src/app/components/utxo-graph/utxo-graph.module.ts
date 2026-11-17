import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsModule } from 'ngx-echarts';
import { SharedModule } from '@app/shared/shared.module';
import { UtxoGraphComponent } from '@components/utxo-graph/utxo-graph.component';

/**
 * Declares UtxoGraphComponent on its own so pages outside GraphsModule, such as the watch-only
 * wallet, can use it without importing GraphsModule and its routes. The echarts provider
 * (NgxEchartsModule.forRoot) comes from the feature module that renders the chart.
 */
@NgModule({
  declarations: [UtxoGraphComponent],
  imports: [CommonModule, SharedModule, NgxEchartsModule],
  exports: [UtxoGraphComponent],
})
export class UtxoGraphModule {}
