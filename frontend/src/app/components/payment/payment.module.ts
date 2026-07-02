import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { SharedModule } from '@app/shared/shared.module';
import { PaymentComponent } from '@components/payment/payment.component';
import { TrackerModule } from '@components/tracker/tracker.module';

const routes: Routes = [
  {
    path: '',
    redirectTo: '/',
    pathMatch: 'full',
  },
  {
    path: ':id',
    component: PaymentComponent,
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
export class PaymentRoutingModule { }

@NgModule({
  imports: [
    CommonModule,
    PaymentRoutingModule,
    SharedModule,
    TrackerModule
  ],
  declarations: [
    PaymentComponent
  ]
})
export class PaymentModule { }






