import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { BlockchainComponent } from './blockchain/blockchain.component';
import { AboutComponent } from './about/about.component';
import { StatisticsComponent } from './statistics/statistics.component';

const routes: Routes = [
  {
    path: '',
    children: [],
    component: BlockchainComponent
  },
  {
    path: 'tx/:id',
    children: [],
    component: BlockchainComponent
  },
  {
    path: 'about',
    children: [],
    component: AboutComponent
  },
  {
    path: 'statistics',
    component: StatisticsComponent,
  },
  {
    path: 'graphs',
    component: StatisticsComponent,
  },
  {
    path: '**',
    redirectTo: ''
  }
];
@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
