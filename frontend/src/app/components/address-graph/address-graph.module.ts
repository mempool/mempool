import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsModule } from 'ngx-echarts';
import { SharedModule } from '@app/shared/shared.module';
import { AddressGraphComponent } from '@components/address-graph/address-graph.component';

/**
 * Declares AddressGraphComponent on its own so pages outside GraphsModule, such as the watch-only
 * wallet, can use it without importing GraphsModule and its routes. The echarts provider
 * (NgxEchartsModule.forRoot) comes from the feature module that renders the chart.
 */
@NgModule({
  declarations: [AddressGraphComponent],
  imports: [CommonModule, SharedModule, NgxEchartsModule],
  exports: [AddressGraphComponent],
})
export class AddressGraphModule {}
