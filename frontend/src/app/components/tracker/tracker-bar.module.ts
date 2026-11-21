import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrackerBarComponent } from '@components/tracker/tracker-bar.component';


@NgModule({
  imports: [
    CommonModule,
  ],
  declarations: [
    TrackerBarComponent,
  ],
  exports: [
    TrackerBarComponent,
  ]
})
export class TrackerBarModule { }
