import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { TermsOfServiceComponent } from '@components/terms-of-service/terms-of-service.component';
import { SharedModule } from '@app/shared/shared.module';

const routes: Routes = [
  {
    path: '',
    component: TermsOfServiceComponent,
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
export class TermsModule { }

@NgModule({
  imports: [
    CommonModule,
    TermsModule,
    SharedModule,
  ],
  declarations: [
    TermsOfServiceComponent,
  ]
})
export class TermsOfServiceModule { }






