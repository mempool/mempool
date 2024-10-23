import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AppPreloadingStrategy } from '@app/app.preloading-strategy'
import { BlockViewComponent } from '@components/block-view/block-view.component';
import { EightBlocksComponent } from '@components/eight-blocks/eight-blocks.component';
import { MempoolBlockViewComponent } from '@components/mempool-block-view/mempool-block-view.component';
import { ClockComponent } from '@components/clock/clock.component';
import { StatusViewComponent } from '@components/status-view/status-view.component';
import { AddressGroupComponent } from '@components/address-group/address-group.component';
import { TrackerComponent } from '@components/tracker/tracker.component';
import { AccelerateCheckout } from '@components/accelerate-checkout/accelerate-checkout.component';
import { TrackerGuard } from '@app/route-guards';

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
        loadChildren: () => import('@app/bitcoin-graphs.module').then(m => m.BitcoinGraphsModule),
        data: { preload: true },
      },
      {
        path: '',
        loadChildren: () => import('@app/master-page.module').then(m => m.MasterPageModule),
        data: { preload: true },
      },
      {
        path: 'widget/wallet',
        children: [],
        component: AddressGroupComponent,
        data: {
          networkSpecific: true,
        }
      },
      {
        path: 'status',
        data: { networks: ['bitcoin', 'liquid'] },
        component: StatusViewComponent
      },
      {
        path: '',
        loadChildren: () => import('@app/bitcoin-graphs.module').then(m => m.BitcoinGraphsModule),
        data: { preload: true },
      },
      {
        path: '**',
        redirectTo: '/testnet'
      },
    ]
  },
  {
    path: 'testnet4',
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadChildren: () => import('@app/bitcoin-graphs.module').then(m => m.BitcoinGraphsModule),
        data: { preload: true },
      },
      {
        path: '',
        loadChildren: () => import('@app/master-page.module').then(m => m.MasterPageModule),
        data: { preload: true },
      },
      {
        path: 'wallet',
        children: [],
        component: AddressGroupComponent,
        data: {
          networkSpecific: true,
        }
      },
      {
        path: 'status',
        data: { networks: ['bitcoin', 'liquid'] },
        component: StatusViewComponent
      },
      {
        path: '',
        loadChildren: () => import('@app/bitcoin-graphs.module').then(m => m.BitcoinGraphsModule),
        data: { preload: true },
      },
      {
        path: '**',
        redirectTo: '/testnet4'
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
        loadChildren: () => import('@app/bitcoin-graphs.module').then(m => m.BitcoinGraphsModule),
        data: { preload: true },
      },
      {
        path: '',
        loadChildren: () => import('@app/master-page.module').then(m => m.MasterPageModule),
        data: { preload: true },
      },
      {
        path: 'widget/wallet',
        children: [],
        component: AddressGroupComponent,
        data: {
          networkSpecific: true,
        }
      },
      {
        path: 'status',
        data: { networks: ['bitcoin', 'liquid'] },
        component: StatusViewComponent
      },
      {
        path: '',
        loadChildren: () => import('@app/bitcoin-graphs.module').then(m => m.BitcoinGraphsModule),
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
    loadChildren: () => import('@app/bitcoin-graphs.module').then(m => m.BitcoinGraphsModule),
    data: { preload: true },
  },
  {
    path: 'tx',
    canMatch: [TrackerGuard],
    runGuardsAndResolvers: 'always',
    loadChildren: () => import('@components/tracker/tracker.module').then(m => m.TrackerModule),
  },
  {
    path: '',
    loadChildren: () => import('@app/master-page.module').then(m => m.MasterPageModule),
    data: { preload: true },
  },
  {
    path: 'widget/wallet',
    children: [],
    component: AddressGroupComponent,
    data: {
      networkSpecific: true,
    }
  },
  {
    path: 'preview',
    children: [
      {
        path: '',
        loadChildren: () => import('@app/previews.module').then(m => m.PreviewsModule)
      },
      {
        path: 'testnet',
        loadChildren: () => import('@app/previews.module').then(m => m.PreviewsModule)
      },
      {
        path: 'testnet4',
        loadChildren: () => import('@app/previews.module').then(m => m.PreviewsModule)
      },
      {
        path: 'signet',
        loadChildren: () => import('@app/previews.module').then(m => m.PreviewsModule)
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
    path: 'view/blocks',
    component: EightBlocksComponent,
  },
  {
    path: 'status',
    data: { networks: ['bitcoin', 'liquid'] },
    component: StatusViewComponent
  },
  {
    path: '',
    loadChildren: () => import('@app/bitcoin-graphs.module').then(m => m.BitcoinGraphsModule),
    data: { preload: true },
  },
];

if (browserWindowEnv && browserWindowEnv.BASE_MODULE === 'liquid') {
  routes = [
    {
      path: 'testnet',
      children: [
        {
          path: '',
          pathMatch: 'full',
          loadChildren: () => import('@app/liquid/liquid-graphs.module').then(m => m.LiquidGraphsModule),
          data: { preload: true },
        },
        {
          path: '',
          loadChildren: () => import ('@app/liquid/liquid-master-page.module').then(m => m.LiquidMasterPageModule),
          data: { preload: true },
        },
        {
          path: 'widget/wallet',
          children: [],
          component: AddressGroupComponent,
          data: {
            networkSpecific: true,
          }
        },
        {
          path: 'status',
          data: { networks: ['bitcoin', 'liquid'] },
          component: StatusViewComponent
        },
        {
          path: '',
          loadChildren: () => import('@app/liquid/liquid-graphs.module').then(m => m.LiquidGraphsModule),
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
      loadChildren: () => import('@app/liquid/liquid-graphs.module').then(m => m.LiquidGraphsModule),
      data: { preload: true },
    },
    {
      path: '',
      loadChildren: () => import ('@app/liquid/liquid-master-page.module').then(m => m.LiquidMasterPageModule),
      data: { preload: true },
    },
    {
      path: 'widget/wallet',
      children: [],
      component: AddressGroupComponent,
      data: {
        networkSpecific: true,
      }
    },
    {
      path: 'preview',
      children: [
        {
          path: '',
          loadChildren: () => import('@app/previews.module').then(m => m.PreviewsModule)
        },
        {
          path: 'testnet',
          loadChildren: () => import('@app/previews.module').then(m => m.PreviewsModule)
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
      loadChildren: () => import('@app/liquid/liquid-graphs.module').then(m => m.LiquidGraphsModule),
      data: { preload: true },
    },
  ];
}

if (!window['isMempoolSpaceBuild']) {
  routes.push({
    path: '**',
    redirectTo: ''
  });
}

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    initialNavigation: 'enabledBlocking',
    scrollPositionRestoration: 'enabled',
    anchorScrolling: 'disabled',
    preloadingStrategy: AppPreloadingStrategy
  })],
})
export class AppRoutingModule { }
