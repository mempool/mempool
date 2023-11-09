import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AppPreloadingStrategy } from './app.preloading-strategy'
import { StartComponent } from './components/start/start.component';
import { BlockViewComponent } from './components/block-view/block-view.component';
import { MempoolBlockViewComponent } from './components/mempool-block-view/mempool-block-view.component';
import { ClockComponent } from './components/clock/clock.component';
import { AddressComponent } from './components/address/address.component';
import { StatusViewComponent } from './components/status-view/status-view.component';
import { PushTransactionComponent } from './components/push-transaction/push-transaction.component';
import { BlocksList } from './components/blocks-list/blocks-list.component';
import { AssetGroupComponent } from './components/assets/asset-group/asset-group.component';
import { AssetsFeaturedComponent } from './components/assets/assets-featured/assets-featured.component';
import { AssetsComponent } from './components/assets/assets.component';
import { AssetComponent } from './components/asset/asset.component';
import { AssetsNavComponent } from './components/assets/assets-nav/assets-nav.component';

const browserWindow = window || {};
// @ts-ignore
const browserWindowEnv = browserWindow.__env || {};

let routes: Routes = [
  {
    path: 'testnet',
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadChildren: () => import('./graphs/graphs.module').then(m => m.GraphsModule),
        data: { preload: true },
      },
      {
        path: '',
        loadChildren: () => import('./master-page.module').then(m => m.MasterPageModule),
        data: { preload: true },
      },
      {
        path: 'status',
        data: { networks: ['bitcoin', 'liquid'] },
        component: StatusViewComponent
      },
      {
        path: '',
        loadChildren: () => import('./graphs/graphs.module').then(m => m.GraphsModule)
      },
      {
        path: '**',
        redirectTo: '/testnet'
      },
    ]
  },
  {
    path: 'signet',
    children: [
      {
        path: 'mining/blocks',
        redirectTo: 'blocks',
        pathMatch: 'full'
      },
      {
        path: '',
        pathMatch: 'full',
        loadChildren: () => import('./graphs/graphs.module').then(m => m.GraphsModule)
      },
      {
        path: '',
        loadChildren: () => import('./master-page.module').then(m => m.MasterPageModule),
        data: { preload: true },
      },
      {
        path: 'status',
        data: { networks: ['bitcoin', 'liquid'] },
        component: StatusViewComponent
      },
      {
        path: '',
        loadChildren: () => import('./graphs/graphs.module').then(m => m.GraphsModule)
      },
      {
        path: '**',
        redirectTo: '/signet'
      },
    ]
  },
  {
    path: '',
    pathMatch: 'full',
    loadChildren: () => import('./graphs/graphs.module').then(m => m.GraphsModule)
  },
  {
    path: '',
    loadChildren: () => import('./master-page.module').then(m => m.MasterPageModule),
    data: { preload: true },
  },
  {
    path: 'preview',
    children: [
      {
        path: '',
        loadChildren: () => import('./previews.module').then(m => m.PreviewsModule)
      },
      {
        path: 'testnet',
        loadChildren: () => import('./previews.module').then(m => m.PreviewsModule)
      },
      {
        path: 'signet',
        loadChildren: () => import('./previews.module').then(m => m.PreviewsModule)
      },
    ],
  },
  {
    path: 'clock',
    redirectTo: 'clock/mempool/0'
  },
  {
    path: 'clock/:mode',
    redirectTo: 'clock/:mode/0'
  },
  {
    path: 'clock/:mode/:index',
    component: ClockComponent,
  },
  {
    path: 'view/block/:id',
    component: BlockViewComponent,
  },
  {
    path: 'view/mempool-block/:index',
    component: MempoolBlockViewComponent,
  },
  {
    path: 'status',
    data: { networks: ['bitcoin', 'liquid'] },
    component: StatusViewComponent
  },
  {
    path: '',
    loadChildren: () => import('./graphs/graphs.module').then(m => m.GraphsModule)
  },
  {
    path: '**',
    redirectTo: ''
  },
];

if (browserWindowEnv && browserWindowEnv.BASE_MODULE === 'bisq') {
  routes = [{
    path: '',
    loadChildren: () => import('./bisq/bisq.module').then(m => m.BisqModule)
  }];
}

if (browserWindowEnv && browserWindowEnv.BASE_MODULE === 'liquid') {
  routes = [
    {
      path: 'testnet',
      children: [
        {
          path: '',
          pathMatch: 'full',
          loadChildren: () => import('./graphs/graphs.module').then(m => m.GraphsModule)
        },
        {
          path: '',
          loadChildren: () => import ('./liquid/liquid-master-page.module').then(m => m.LiquidMasterPageModule)
        },
        {
          path: 'status',
          data: { networks: ['bitcoin', 'liquid'] },
          component: StatusViewComponent
        },
        {
          path: '',
          loadChildren: () => import('./graphs/graphs.module').then(m => m.GraphsModule)
        },
        {
          path: '**',
          redirectTo: '/signet'
        },
      ]
    },
    {
      path: '',
      pathMatch: 'full',
      loadChildren: () => import('./graphs/graphs.module').then(m => m.GraphsModule)
    },
    {
      path: '',
      loadChildren: () => import ('./liquid/liquid-master-page.module').then(m => m.LiquidMasterPageModule)
    },
    {
      path: 'preview',
      children: [
        {
          path: '',
          loadChildren: () => import('./previews.module').then(m => m.PreviewsModule)
        },
        {
          path: 'testnet',
          loadChildren: () => import('./previews.module').then(m => m.PreviewsModule)
        },
      ],
    },
    {
      path: 'status',
      data: { networks: ['bitcoin', 'liquid']},
      component: StatusViewComponent
    },
    {
      path: '',
      loadChildren: () => import('./graphs/graphs.module').then(m => m.GraphsModule)
    },
    {
      path: '**',
      redirectTo: ''
    },
  ];
}

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    initialNavigation: 'enabledBlocking',
    scrollPositionRestoration: 'enabled',
    anchorScrolling: 'enabled',
    preloadingStrategy: AppPreloadingStrategy
  })],
})
export class AppRoutingModule { }
