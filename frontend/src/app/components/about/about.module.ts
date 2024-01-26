import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { AboutComponent } from './about.component';
import { AboutSponsorsComponent } from './about-sponsors.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  {
    path: '',
    component: AboutComponent,
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
export class AboutRoutingModule { }

@NgModule({
  imports: [
    CommonModule,
    AboutRoutingModule,
    SharedModule,
  ],
  declarations: [
    AboutComponent,
    AboutSponsorsComponent,
  ],
  exports: [
    AboutSponsorsComponent,
  ]
})
export class AboutModule { }






