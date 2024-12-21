import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { PrivacyPolicyComponent } from '@components/privacy-policy/privacy-policy.component';
import { SharedModule } from '@app/shared/shared.module';

const routes: Routes = [
  {
    path: '',
    component: PrivacyPolicyComponent,
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
export class PrivacyPolicyRoutingModule { }

@NgModule({
  imports: [
    CommonModule,
    PrivacyPolicyRoutingModule,
    SharedModule,
  ],
  declarations: [
    PrivacyPolicyComponent,
  ]
})
export class PrivacyPolicyModule { }






