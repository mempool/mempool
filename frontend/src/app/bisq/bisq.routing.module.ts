import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StartComponent } from '../components/start/start.component';
import { TransactionComponent } from '../components/transaction/transaction.component';
import { BlockComponent } from '../components/block/block.component';
import { MempoolBlockComponent } from '../components/mempool-block/mempool-block.component';
import { AboutComponent } from '../components/about/about.component';
import { AddressComponent } from '../components/address/address.component';
import { BisqTransactionsComponent } from './bisq-transactions/bisq-transactions.component';
import { StatisticsComponent } from '../components/statistics/statistics.component';

const routes: Routes = [
  {
    path: '',
    component: StartComponent,
    children: [
      {
        path: '',
        component: BisqTransactionsComponent
      },
      {
        path: 'tx/:id',
        component: TransactionComponent
      },
      {
        path: 'block/:id',
        component: BlockComponent
      },
      {
        path: 'mempool-block/:id',
        component: MempoolBlockComponent
      },
    ],
  },
  {
    path: 'graphs',
    component: StatisticsComponent,
  },
  {
    path: 'about',
    component: AboutComponent,
  },
  {
    path: 'address/:id',
    children: [],
    component: AddressComponent
  },
  {
    path: '**',
    redirectTo: ''
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BisqRoutingModule { }
