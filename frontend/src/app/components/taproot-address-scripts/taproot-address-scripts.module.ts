import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NgxEchartsModule } from 'ngx-echarts';
import { SharedModule } from '@app/shared/shared.module';
import { AsmStylerPipe } from '@app/shared/pipes/asm-styler/asm-styler.pipe';
import { TaprootAddressScriptsComponent } from '@components/taproot-address-scripts/taproot-address-scripts.component';

@NgModule({
  declarations: [
    TaprootAddressScriptsComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    NgxEchartsModule,
  ],
  exports: [
    TaprootAddressScriptsComponent,
  ],
  providers: [
    AsmStylerPipe,
  ],
})
export class TaprootAddressScriptsModule { }
