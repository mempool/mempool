import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AboutComponent } from '../components/about/about.component';
import { BisqTransactionsComponent } from './bisq-transactions/bisq-transactions.component';
import { BisqTransactionComponent } from './bisq-transaction/bisq-transaction.component';
import { BisqBlockComponent } from './bisq-block/bisq-block.component';
import { BisqBlocksComponent } from './bisq-blocks/bisq-blocks.component';
import { BisqExplorerComponent } from './bisq-explorer/bisq-explorer.component';
import { BisqAddressComponent } from './bisq-address/bisq-address.component';
import { BisqStatsComponent } from './bisq-stats/bisq-stats.component';

const routes: Routes = [
  {
    path: '',
    component: BisqExplorerComponent,
    children: [
      {
        path: '',
        component: BisqTransactionsComponent
      },
      {
        path: 'tx/:id',
        component: BisqTransactionComponent
      },
      {
        path: 'blocks',
        children: [],
        component: BisqBlocksComponent
      },
      {
        path: 'block/:id',
        component: BisqBlockComponent,
      },
      {
        path: 'address/:id',
        component: BisqAddressComponent,
      },
      {
        path: 'stats',
        component: BisqStatsComponent,
      },
      {
        path: 'about',
        component: AboutComponent,
      },
      {
        path: '**',
        redirectTo: ''
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BisqRoutingModule { }
