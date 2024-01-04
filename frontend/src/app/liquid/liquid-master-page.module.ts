import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { LiquidMasterPageComponent } from '../components/liquid-master-page/liquid-master-page.component';

import { StartComponent } from '../components/start/start.component';
import { AddressComponent } from '../components/address/address.component';
import { PushTransactionComponent } from '../components/push-transaction/push-transaction.component';
import { BlocksList } from '../components/blocks-list/blocks-list.component';
import { AssetGroupComponent } from '../components/assets/asset-group/asset-group.component';
import { AssetsComponent } from '../components/assets/assets.component';
import { AssetsFeaturedComponent } from '../components/assets/assets-featured/assets-featured.component'
import { AssetComponent } from '../components/asset/asset.component';
import { AssetsNavComponent } from '../components/assets/assets-nav/assets-nav.component';

const routes: Routes = [
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
        loadChildren: () => import('../components/about/about.module').then(m => m.AboutModule),
      },
      {
        path: 'blocks',
        component: BlocksList,
      },
      {
        path: 'terms-of-service',
        loadChildren: () => import('../components/terms-of-service/terms-of-service.module').then(m => m.TermsOfServiceModule),
      },
      {
        path: 'privacy-policy',
        loadChildren: () => import('../components/privacy-policy/privacy-policy.module').then(m => m.PrivacyPolicyModule),
      },
      {
        path: 'trademark-policy',
        loadChildren: () => import('../components/trademark-policy/trademark-policy.module').then(m => m.TrademarkModule),
      },
      {
        path: 'address/:id',
        children: [],
        component: AddressComponent,
        data: {
          ogImage: true,
          networkSpecific: true,
        }
      },
      {
        path: 'tx',
        component: StartComponent,
        data: { preload: true, networkSpecific: true },
        loadChildren: () => import('../components/transaction/transaction.module').then(m => m.TransactionModule),
      },
      {
        path: 'block',
        component: StartComponent,
        data: { preload: true, networkSpecific: true },
        loadChildren: () => import('../components/block/block.module').then(m => m.BlockModule),
      },
      {
        path: 'assets',
        data: { networks: ['liquid'] },
        component: AssetsNavComponent,
        children: [
          {
            path: 'all',
            data: { networks: ['liquid'] },
            component: AssetsComponent,
          },
          {
            path: 'featured',
            data: { networks: ['liquid'] },
            component: AssetsFeaturedComponent,
          },
          {
            path: 'asset/:id',
            data: { networkSpecific: true },
            component: AssetComponent
          },
          {
            path: 'group/:id',
            data: { networkSpecific: true },
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
        loadChildren: () => import('../docs/docs.module').then(m => m.DocsModule),
        data: { preload: true },
      },
      {
        path: 'api',
        loadChildren: () => import('../docs/docs.module').then(m => m.DocsModule)
      },
    ],
  },
];

@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ],
  exports: [
    RouterModule
  ]
})
export class LiquidRoutingModule { }

@NgModule({
  imports: [
    CommonModule,
    LiquidRoutingModule,
    SharedModule,
  ],
  declarations: [
    LiquidMasterPageComponent,
  ]
})
export class LiquidMasterPageModule { }