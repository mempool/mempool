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
import { NodesPerISPChartComponent } from '../lightning/nodes-per-isp-chart/nodes-per-isp-chart.component';
import { NodesPerCountryChartComponent } from '../lightning/nodes-per-country-chart/nodes-per-country-chart.component';
import { NodesMap } from '../lightning/nodes-map/nodes-map.component';
import { NodesChannelsMap } from '../lightning/nodes-channels-map/nodes-channels-map.component';

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
            path: 'lightning/nodes-networks',
            data: { networks: ['bitcoin'] },
            component: NodesNetworksChartComponent,
          },
          {
            path: 'lightning/capacity',
            data: { networks: ['bitcoin'] },
            component: LightningStatisticsChartComponent,
          },
          {
            path: 'lightning/nodes-per-isp',
            data: { networks: ['bitcoin'] },
            component: NodesPerISPChartComponent,
          },
          {
            path: 'lightning/nodes-per-country',
            data: { networks: ['bitcoin'] },
            component: NodesPerCountryChartComponent,
          },
          {
            path: 'lightning/nodes-map',
            data: { networks: ['bitcoin'] },
            component: NodesMap,
          },
          {
            path: 'lightning/nodes-channels-map',
            data: { networks: ['bitcoin'] },
            component: NodesChannelsMap,
          },
          {
            path: '',
            pathMatch: 'full',
            redirectTo: 'mempool',
          },
          {
            path: 'mining/block-prediction',
            data: { networks: ['bitcoin'] },
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
    data: { networks: ['bitcoin', 'liquid'] },
    component: TelevisionComponent
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class GraphsRoutingModule { }
