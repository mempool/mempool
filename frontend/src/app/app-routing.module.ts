import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { StartComponent } from './components/start/start.component';
import { TransactionComponent } from './components/transaction/transaction.component';
import { BlockComponent } from './components/block/block.component';
import { AddressComponent } from './components/address/address.component';
import { MasterPageComponent } from './components/master-page/master-page.component';
import { AboutComponent } from './components/about/about.component';
import { TelevisionComponent } from './components/television/television.component';
import { StatisticsComponent } from './components/statistics/statistics.component';
import { MempoolBlockComponent } from './components/mempool-block/mempool-block.component';
import { LatestBlocksComponent } from './components/latest-blocks/latest-blocks.component';
import { AssetComponent } from './components/asset/asset.component';
import { AssetsComponent } from './assets/assets.component';
import { StatusViewComponent } from './components/status-view/status-view.component';

const routes: Routes = [
  {
    path: '',
    component: MasterPageComponent,
    children: [
      {
        path: '',
        component: StartComponent,
        children: [
          {
            path: '',
            component: LatestBlocksComponent
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
    ],
  },
  {
    path: 'liquid',
    component: MasterPageComponent,
    children: [
      {
        path: '',
        component: StartComponent,
        children: [
          {
            path: '',
            component: LatestBlocksComponent
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
        path: 'tv',
        component: TelevisionComponent,
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
      },
    ],
  },
  {
    path: 'liquid',
    component: MasterPageComponent,
    children: [
      {
        path: '',
        component: StartComponent,
        children: [
          {
            path: '',
            component: LatestBlocksComponent
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
        path: 'asset/:id',
        component: AssetComponent
      },
      {
        path: 'assets',
        component: AssetsComponent,
      },
      {
        path: '**',
        redirectTo: ''
      },
    ],
  },
  {
    path: 'testnet',
    component: MasterPageComponent,
    children: [
      {
        path: '',
        component: StartComponent,
        children: [
          {
            path: '',
            component: LatestBlocksComponent
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
      },
    ],
  },
  {
    path: 'tv',
    component: TelevisionComponent,
  },
  {
    path: 'liquid-tv',
    component: TelevisionComponent,
  },
  {
    path: 'testnet-tv',
    component: TelevisionComponent,
  },
  {
    path: 'status-view',
    component: StatusViewComponent
  },
  {
    path: 'liquid-status-view',
    component: StatusViewComponent
  },
  {
    path: 'testnet-status-view',
    component: StatusViewComponent
  },
  {
    path: '**',
    redirectTo: ''
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
