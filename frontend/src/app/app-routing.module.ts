import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AppPreloadingStrategy } from './app.preloading-strategy'
import { BlockViewComponent } from './components/block-view/block-view.component';
import { MempoolBlockViewComponent } from './components/mempool-block-view/mempool-block-view.component';
import { ClockComponent } from './components/clock/clock.component';
import { StatusViewComponent } from './components/status-view/status-view.component';

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
        loadChildren: () => import('./bitcoin-graphs.module').then(m => m.BitcoinGraphsModule),
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
        loadChildren: () => import('./bitcoin-graphs.module').then(m => m.BitcoinGraphsModule),
        data: { preload: true },
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
        loadChildren: () => import('./bitcoin-graphs.module').then(m => m.BitcoinGraphsModule),
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
        loadChildren: () => import('./bitcoin-graphs.module').then(m => m.BitcoinGraphsModule),
        data: { preload: true },
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
    loadChildren: () => import('./bitcoin-graphs.module').then(m => m.BitcoinGraphsModule),
    data: { preload: true },
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
    loadChildren: () => import('./bitcoin-graphs.module').then(m => m.BitcoinGraphsModule),
    data: { preload: true },
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
          loadChildren: () => import('./liquid/liquid-graphs.module').then(m => m.LiquidGraphsModule),
          data: { preload: true },
        },
        {
          path: '',
          loadChildren: () => import ('./liquid/liquid-master-page.module').then(m => m.LiquidMasterPageModule),
          data: { preload: true },
        },
        {
          path: 'status',
          data: { networks: ['bitcoin', 'liquid'] },
          component: StatusViewComponent
        },
        {
          path: '',
          loadChildren: () => import('./liquid/liquid-graphs.module').then(m => m.LiquidGraphsModule),
          data: { preload: true },
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
      loadChildren: () => import('./liquid/liquid-graphs.module').then(m => m.LiquidGraphsModule),
      data: { preload: true },
    },
    {
      path: '',
      loadChildren: () => import ('./liquid/liquid-master-page.module').then(m => m.LiquidMasterPageModule),
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
      ],
    },
    {
      path: 'status',
      data: { networks: ['bitcoin', 'liquid']},
      component: StatusViewComponent
    },
    {
      path: '',
      loadChildren: () => import('./liquid/liquid-graphs.module').then(m => m.LiquidGraphsModule),
      data: { preload: true },
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
