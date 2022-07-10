import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BlockPredictionGraphComponent } from '../components/block-prediction-graph/block-prediction-graph.component';
import { BlockFeeRatesGraphComponent } from '../components/block-fee-rates-graph/block-fee-rates-graph.component';
import { BlockFeesGraphComponent } from '../components/block-fees-graph/block-fees-graph.component';
import { BlockRewardsGraphComponent } from '../components/block-rewards-graph/block-rewards-graph.component';
import { BlockSizesWeightsGraphComponent } from '../components/block-sizes-weights-graph/block-sizes-weights-graph.component';
import { GraphsComponent } from '../components/graphs/graphs.component';
import { HashrateChartComponent } from '../components/hashrate-chart/hashrate-chart.component';
import { HashrateChartPoolsComponent } from '../components/hashrates-chart-pools/hashrate-chart-pools.component';
import { LiquidMasterPageComponent } from '../components/liquid-master-page/liquid-master-page.component';
import { MasterPageComponent } from '../components/master-page/master-page.component';
import { MempoolBlockComponent } from '../components/mempool-block/mempool-block.component';
import { MiningDashboardComponent } from '../components/mining-dashboard/mining-dashboard.component';
import { PoolRankingComponent } from '../components/pool-ranking/pool-ranking.component';
import { PoolComponent } from '../components/pool/pool.component';
import { StartComponent } from '../components/start/start.component';
import { StatisticsComponent } from '../components/statistics/statistics.component';
import { TelevisionComponent } from '../components/television/television.component';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { NodesNetworksChartComponent } from '../lightning/nodes-networks-chart/nodes-networks-chart.component';
import { LightningStatisticsChartComponent } from '../lightning/statistics-chart/lightning-statistics-chart.component';

const browserWindow = window || {};
// @ts-ignore
const browserWindowEnv = browserWindow.__env || {};
const isLiquid = browserWindowEnv && browserWindowEnv.BASE_MODULE === 'liquid';

const routes: Routes = [
  {
    path: '',
    component: isLiquid ? LiquidMasterPageComponent : MasterPageComponent,
    children: [
      {
        path: 'mining/pool/:slug',
        component: PoolComponent,
      },
      {
        path: 'mining',
        component: StartComponent,
        children: [
          {
            path: '',
            component: MiningDashboardComponent,
          },
        ]
      },
      {
        path: 'mempool-block/:id',
        component: StartComponent,
        children: [
          {
            path: '',
            component: MempoolBlockComponent,
          },
        ]
      },
      {
        path: 'graphs',
        component: GraphsComponent,
        children: [
          {
            path: 'mempool',
            component: StatisticsComponent,
          },
          {
            path: 'mining/hashrate-difficulty',
            component: HashrateChartComponent,
          },
          {
            path: 'mining/pools-dominance',
            component: HashrateChartPoolsComponent,
          },
          {
            path: 'mining/pools',
            component: PoolRankingComponent,
          },
          {
            path: 'mining/block-fees',
            component: BlockFeesGraphComponent,
          },
          {
            path: 'mining/block-rewards',
            component: BlockRewardsGraphComponent,
          },
          {
            path: 'mining/block-fee-rates',
            component: BlockFeeRatesGraphComponent,
          },
          {
            path: 'mining/block-sizes-weights',
            component: BlockSizesWeightsGraphComponent,
          },
          {
            path: 'lightning/nodes-networks',
            component: NodesNetworksChartComponent,
          },
          {
            path: 'lightning/capacity',
            component: LightningStatisticsChartComponent,
          },
          {
            path: '',
            redirectTo: 'mempool',
          },
          {
            path: 'mining/block-prediction',
            component: BlockPredictionGraphComponent,
          },
        ]
      },
      {
        path: '',
        component: StartComponent,
        children: [{
          path: '',
          component: DashboardComponent,
        }]
      },
    ]
  },
  {
    path: 'tv',
    component: TelevisionComponent
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class GraphsRoutingModule { }
