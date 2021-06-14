import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AboutComponent } from '../components/about/about.component';
import { BisqTransactionsComponent } from './bisq-transactions/bisq-transactions.component';
import { BisqTransactionComponent } from './bisq-transaction/bisq-transaction.component';
import { BisqBlockComponent } from './bisq-block/bisq-block.component';
import { BisqBlocksComponent } from './bisq-blocks/bisq-blocks.component';
import { BisqAddressComponent } from './bisq-address/bisq-address.component';
import { BisqStatsComponent } from './bisq-stats/bisq-stats.component';
import { ApiDocsComponent } from '../components/api-docs/api-docs.component';
import { BisqDashboardComponent } from './bisq-dashboard/bisq-dashboard.component';
import { BisqMarketComponent } from './bisq-market/bisq-market.component';
import { BisqMainDashboardComponent } from './bisq-main-dashboard/bisq-main-dashboard.component';
import { TermsOfServiceComponent } from '../components/terms-of-service/terms-of-service.component';

const routes: Routes = [
  {
    path: '',
    component: BisqMainDashboardComponent,
  },
  {
    path: 'markets',
    component: BisqDashboardComponent,
  },
  {
    path: 'transactions',
    component: BisqTransactionsComponent,
  },
  {
    path: 'market/:pair',
    component: BisqMarketComponent,
  },
  {
    path: 'tx/:id',
    component: BisqTransactionComponent,
  },
  {
    path: 'blocks',
    children: [],
    component: BisqBlocksComponent,
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
    path: 'api',
    component: ApiDocsComponent,
  },
  {
    path: 'terms-of-service',
    component: TermsOfServiceComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BisqRoutingModule {}
