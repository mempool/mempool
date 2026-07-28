import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { GettingStartedComponent } from '@components/getting-started/getting-started.component';
import { SharedModule } from '@app/shared/shared.module';

const routes: Routes = [
  {
    path: '',
    component: GettingStartedComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GettingStartedRoutingModule {}

@NgModule({
  imports: [CommonModule, GettingStartedRoutingModule, SharedModule],
  declarations: [GettingStartedComponent],
})
export class GettingStartedModule {}
