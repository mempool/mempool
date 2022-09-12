import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AppPreloadingStrategy } from './app.preloading-strategy'
import { StartComponent } from './components/start/start.component';
import { TransactionComponent } from './components/transaction/transaction.component';
import { BlockComponent } from './components/block/block.component';
import { BlockAuditComponent } from './components/block-audit/block-audit.component';
import { AddressComponent } from './components/address/address.component';
import { MasterPageComponent } from './components/master-page/master-page.component';
import { AboutComponent } from './components/about/about.component';
import { StatusViewComponent } from './components/status-view/status-view.component';
import { TermsOfServiceComponent } from './components/terms-of-service/terms-of-service.component';
import { PrivacyPolicyComponent } from './components/privacy-policy/privacy-policy.component';
import { TrademarkPolicyComponent } from './components/trademark-policy/trademark-policy.component';
import { BisqMasterPageComponent } from './components/bisq-master-page/bisq-master-page.component';
import { PushTransactionComponent } from './components/push-transaction/push-transaction.component';
import { BlocksList } from './components/blocks-list/blocks-list.component';
import { LiquidMasterPageComponent } from './components/liquid-master-page/liquid-master-page.component';
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
        component: MasterPageComponent,
        children: [
          {
            path: 'mining/blocks',
            redirectTo: 'blocks',
            pathMatch: 'full'
          },
          {
            path: 'tx/push',
            component: PushTransactionComponent,
          },
          {
            path: 'about',
            component: AboutComponent,
          },
          {
            path: 'blocks',
            component: BlocksList,
          },
          {
            path: 'terms-of-service',
            component: TermsOfServiceComponent
          },
          {
            path: 'privacy-policy',
            component: PrivacyPolicyComponent
          },
          {
            path: 'trademark-policy',
            component: TrademarkPolicyComponent
          },
          {
            path: 'address/:id',
            children: [],
            component: AddressComponent,
            data: {
              ogImage: true
            }
          },
          {
            path: 'tx',
            component: StartComponent,
            children: [
              {
                path: ':id',
                component: TransactionComponent
              },
            ],
          },
          {
            path: 'block',
            component: StartComponent,
              children: [
              {
                path: ':id',
                component: BlockComponent,
                data: {
                  ogImage: true
                }
              },
            ],
          },
          {
            path: 'block-audit',
            children: [
              {
                path: ':id',
                component: BlockAuditComponent,
              },
            ],
          },
          {
            path: 'docs',
            loadChildren: () => import('./docs/docs.module').then(m => m.DocsModule),
            data: { preload: true },
          },
          {
            path: 'api',
            loadChildren: () => import('./docs/docs.module').then(m => m.DocsModule)
          },
          {
            path: 'lightning',
            loadChildren: () => import('./lightning/lightning.module').then(m => m.LightningModule),
            data: { preload: browserWindowEnv && browserWindowEnv.LIGHTNING === true },
          },
        ],
      },
      {
        path: 'status',
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
        component: MasterPageComponent,
        children: [
          {
            path: 'tx/push',
            component: PushTransactionComponent,
          },
          {
            path: 'about',
            component: AboutComponent,
          },
          {
            path: 'blocks',
            component: BlocksList,
          },
          {
            path: 'terms-of-service',
            component: TermsOfServiceComponent
          },
          {
            path: 'privacy-policy',
            component: PrivacyPolicyComponent
          },
          {
            path: 'trademark-policy',
            component: TrademarkPolicyComponent
          },
          {
            path: 'address/:id',
            children: [],
            component: AddressComponent,
            data: {
              ogImage: true
            }
          },
          {
            path: 'tx',
            component: StartComponent,
            children: [
              {
                path: ':id',
                component: TransactionComponent
              },
            ],
          },
          {
            path: 'block',
            component: StartComponent,
            children: [
              {
                path: ':id',
                component: BlockComponent,
                data: {
                  ogImage: true
                }
              },
            ],
          },
          {
            path: 'block-audit',
            children: [
              {
                path: ':id',
                component: BlockAuditComponent,
              },
            ],
          },
          {
            path: 'docs',
            loadChildren: () => import('./docs/docs.module').then(m => m.DocsModule)
          },
          {
            path: 'api',
            loadChildren: () => import('./docs/docs.module').then(m => m.DocsModule)
          },
          {
            path: 'lightning',
            loadChildren: () => import('./lightning/lightning.module').then(m => m.LightningModule)
          },
        ],
      },
      {
        path: 'status',
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
    component: MasterPageComponent,
    children: [
      {
        path: 'mining/blocks',
        redirectTo: 'blocks',
        pathMatch: 'full'
      },
      {
        path: 'tx/push',
        component: PushTransactionComponent,
      },
      {
        path: 'about',
        component: AboutComponent,
      },
      {
        path: 'blocks',
        component: BlocksList,
      },
      {
        path: 'terms-of-service',
        component: TermsOfServiceComponent
      },
      {
        path: 'privacy-policy',
        component: PrivacyPolicyComponent
      },
      {
        path: 'trademark-policy',
        component: TrademarkPolicyComponent
      },
      {
        path: 'address/:id',
        children: [],
        component: AddressComponent,
        data: {
          ogImage: true
        }
      },
      {
        path: 'tx',
        component: StartComponent,
        children: [
          {
            path: ':id',
            component: TransactionComponent
          },
        ],
      },
      {
        path: 'block',
        component: StartComponent,
        children: [
          {
            path: ':id',
            component: BlockComponent,
            data: {
              ogImage: true
            }
          },
        ],
      },
      {
        path: 'block-audit',
        children: [
          {
            path: ':id',
            component: BlockAuditComponent
          },
        ],
      },
      {
        path: 'docs',
        loadChildren: () => import('./docs/docs.module').then(m => m.DocsModule)
      },
      {
        path: 'api',
        loadChildren: () => import('./docs/docs.module').then(m => m.DocsModule)
      },
      {
        path: 'lightning',
        loadChildren: () => import('./lightning/lightning.module').then(m => m.LightningModule)
      },
    ],
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
    path: 'status',
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
    component: BisqMasterPageComponent,
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
          component: LiquidMasterPageComponent,
          children: [
            {
              path: 'tx/push',
              component: PushTransactionComponent,
            },
            {
              path: 'about',
              component: AboutComponent,
            },
            {
              path: 'blocks',
              component: BlocksList,
            },
            {
              path: 'terms-of-service',
              component: TermsOfServiceComponent
            },
            {
              path: 'privacy-policy',
              component: PrivacyPolicyComponent
            },
            {
              path: 'trademark-policy',
              component: TrademarkPolicyComponent
            },
            {
              path: 'address/:id',
              children: [],
              component: AddressComponent,
              data: {
                ogImage: true
              }
            },
            {
              path: 'tx',
              component: StartComponent,
              children: [
                {
                  path: ':id',
                  component: TransactionComponent
                },
              ],
            },
            {
              path: 'block',
              component: StartComponent,
              children: [
                {
                  path: ':id',
                  component: BlockComponent,
                  data: {
                    ogImage: true
                  }
                },
              ],
            },
            {
              path: 'assets',
              component: AssetsNavComponent,
              children: [
                {
                  path: 'all',
                  component: AssetsComponent,
                },
                {
                  path: 'asset/:id',
                  component: AssetComponent
                },
                {
                  path: 'group/:id',
                  component: AssetGroupComponent
                },
                {
                  path: '**',
                  redirectTo: 'all'
                }
              ]
            },
            {
              path: 'docs',
              loadChildren: () => import('./docs/docs.module').then(m => m.DocsModule)
            },
            {
              path: 'api',
              loadChildren: () => import('./docs/docs.module').then(m => m.DocsModule)
            },
          ],
        },
        {
          path: 'status',
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
      component: LiquidMasterPageComponent,
      children: [
        {
          path: 'tx/push',
          component: PushTransactionComponent,
        },
        {
          path: 'about',
          component: AboutComponent,
        },
        {
          path: 'blocks',
          component: BlocksList,
        },
        {
          path: 'terms-of-service',
          component: TermsOfServiceComponent
        },
        {
          path: 'privacy-policy',
          component: PrivacyPolicyComponent
        },
        {
          path: 'trademark-policy',
          component: TrademarkPolicyComponent
        },
        {
          path: 'address/:id',
          children: [],
          component: AddressComponent,
          data: {
            ogImage: true
          }
        },
        {
          path: 'tx',
          component: StartComponent,
          children: [
            {
              path: ':id',
              component: TransactionComponent
            },
          ],
        },
        {
          path: 'block',
          component: StartComponent,
          children: [
            {
              path: ':id',
              component: BlockComponent,
              data: {
                ogImage: true
              }
            },
          ],
        },
        {
          path: 'assets',
          component: AssetsNavComponent,
          children: [
            {
              path: 'featured',
              component: AssetsFeaturedComponent,
            },
            {
              path: 'all',
              component: AssetsComponent,
            },
            {
              path: 'asset/:id',
              component: AssetComponent
            },
            {
              path: 'group/:id',
              component: AssetGroupComponent
            },
            {
              path: '**',
              redirectTo: 'featured'
            }
          ]
        },
        {
          path: 'docs',
          loadChildren: () => import('./docs/docs.module').then(m => m.DocsModule)
        },
        {
          path: 'api',
          loadChildren: () => import('./docs/docs.module').then(m => m.DocsModule)
        },
      ],
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
    initialNavigation: 'enabled',
    scrollPositionRestoration: 'enabled',
    anchorScrolling: 'enabled',
    preloadingStrategy: AppPreloadingStrategy
  })],
})
export class AppRoutingModule { }
