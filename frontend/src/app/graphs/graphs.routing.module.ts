import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BlockHealthGraphComponent } from '@components/block-health-graph/block-health-graph.component';
import { BlockFeeRatesGraphComponent } from '@components/block-fee-rates-graph/block-fee-rates-graph.component';
import { BlockFeesGraphComponent } from '@components/block-fees-graph/block-fees-graph.component';
import { BlockFeesSubsidyGraphComponent } from '@components/block-fees-subsidy-graph/block-fees-subsidy-graph.component';
import { BlockRewardsGraphComponent } from '@components/block-rewards-graph/block-rewards-graph.component';
import { BlockSizesWeightsGraphComponent } from '@components/block-sizes-weights-graph/block-sizes-weights-graph.component';
import { GraphsComponent } from '@components/graphs/graphs.component';
import { HashrateChartComponent } from '@components/hashrate-chart/hashrate-chart.component';
import { HashrateChartPoolsComponent } from '@components/hashrates-chart-pools/hashrate-chart-pools.component';
import { MempoolBlockComponent } from '@components/mempool-block/mempool-block.component';
import { MiningDashboardComponent } from '@components/mining-dashboard/mining-dashboard.component';
import { AcceleratorDashboardComponent } from '@components/acceleration/accelerator-dashboard/accelerator-dashboard.component';
import { PoolRankingComponent } from '@components/pool-ranking/pool-ranking.component';
import { PoolComponent } from '@components/pool/pool.component';
import { StartComponent } from '@components/start/start.component';
import { StatisticsComponent } from '@components/statistics/statistics.component';
import { TelevisionComponent } from '@components/television/television.component';
import { DashboardComponent } from '@app/dashboard/dashboard.component';
import { CustomDashboardComponent } from '@components/custom-dashboard/custom-dashboard.component';
import { AccelerationFeesGraphComponent } from '@components/acceleration/acceleration-fees-graph/acceleration-fees-graph.component';
import { AccelerationsListComponent } from '@components/acceleration/accelerations-list/accelerations-list.component';
import { AddressComponent } from '@components/address/address.component';
import { WalletComponent } from '@components/wallet/wallet.component';

const browserWindow = window || {};
// @ts-ignore
const browserWindowEnv = browserWindow.__env || {};
const isCustomized = browserWindowEnv?.customize;

const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'mining/pool/:slug',
        data: { networks: ['bitcoin'] },
        component: PoolComponent,
      },
      {
        path: 'mining',
        data: { networks: ['bitcoin'] },
        component: StartComponent,
        children: [
          {
            path: '',
            component: MiningDashboardComponent,
          },
        ]
      },
      {
        path: 'acceleration',
        data: { networks: ['bitcoin'], networkSpecific: true, onlySubnet: [''] },
        component: StartComponent,
        children: [
          {
            path: '',
            component: AcceleratorDashboardComponent,
          }
        ]
      },
      {
        path: 'acceleration/list/:page',
        data: { networks: ['bitcoin'], networkSpecific: true, onlySubnet: [''] },
        component: AccelerationsListComponent,
      },
      {
        path: 'acceleration/list',
        redirectTo: 'acceleration/list/1',
      },
      {
        path: 'mempool-block/:id',
        data: { networks: ['bitcoin', 'liquid'] },
        component: StartComponent,
        children: [
          {
            path: '',
            component: MempoolBlockComponent,
          },
        ]
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
        path: 'wallet/:wallet',
        children: [],
        component: WalletComponent,
        data: {
          ogImage: true,
          networkSpecific: true,
        }
      },
      {
        path: 'graphs',
        data: { networks: ['bitcoin', 'liquid'] },
        component: GraphsComponent,
        children: [
          {
            path: 'mempool',
            data: { networks: ['bitcoin', 'liquid'] },
            component: StatisticsComponent,
          },
          {
            path: 'mining/hashrate-difficulty',
            data: { networks: ['bitcoin'] },
            component: HashrateChartComponent,
          },
          {
            path: 'mining/pools-dominance',
            data: { networks: ['bitcoin'] },
            component: HashrateChartPoolsComponent,
          },
          {
            path: 'mining/pools',
            data: { networks: ['bitcoin'] },
            component: PoolRankingComponent,
          },
          {
            path: 'mining/block-fees',
            data: { networks: ['bitcoin'] },
            component: BlockFeesGraphComponent,
          },
          {
            path: 'mining/block-fees-subsidy',
            data: { networks: ['bitcoin'] },
            component: BlockFeesSubsidyGraphComponent,
          },
          {
            path: 'mining/block-rewards',
            data: { networks: ['bitcoin'] },
            component: BlockRewardsGraphComponent,
          },
          {
            path: 'mining/block-fee-rates',
            data: { networks: ['bitcoin'] },
            component: BlockFeeRatesGraphComponent,
          },
          {
            path: 'mining/block-sizes-weights',
            data: { networks: ['bitcoin'] },
            component: BlockSizesWeightsGraphComponent,
          },
          {
            path: 'acceleration/fees',
            data: { networks: ['bitcoin'], networkSpecific: true, onlySubnet: [''] },
            component: AccelerationFeesGraphComponent,
          },
          {
            path: 'lightning',
            data: { preload: true, networks: ['bitcoin'] },
            loadChildren: () => import ('@app/graphs/lightning-graphs.module').then(m => m.LightningGraphsModule),
          },
          {
            path: '',
            pathMatch: 'full',
            redirectTo: 'mempool',
          },
          {
            path: 'mining/block-health',
            data: { networks: ['bitcoin'] },
            component: BlockHealthGraphComponent,
          },
        ]
      },
      {
        path: '',
        component: StartComponent,
        children: [{
          path: '',
          component: isCustomized ? CustomDashboardComponent : DashboardComponent,
        }]
      },
    ]
  },
  {
    path: 'tv',
    data: { networks: ['bitcoin', 'liquid'] },
    component: TelevisionComponent
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class GraphsRoutingModule { }
