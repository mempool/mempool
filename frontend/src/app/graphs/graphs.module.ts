import { NgModule } from '@angular/core';
import { NgxEchartsModule } from 'ngx-echarts';
import { GraphsRoutingModule } from './graphs.routing.module';
import { SharedModule } from '../shared/shared.module';

import { BlockFeesGraphComponent } from '../components/block-fees-graph/block-fees-graph.component';
import { BlockRewardsGraphComponent } from '../components/block-rewards-graph/block-rewards-graph.component';
import { BlockFeeRatesGraphComponent } from '../components/block-fee-rates-graph/block-fee-rates-graph.component';
import { BlockSizesWeightsGraphComponent } from '../components/block-sizes-weights-graph/block-sizes-weights-graph.component';
import { FeeDistributionGraphComponent } from '../components/fee-distribution-graph/fee-distribution-graph.component';
import { IncomingTransactionsGraphComponent } from '../components/incoming-transactions-graph/incoming-transactions-graph.component';
import { MempoolGraphComponent } from '../components/mempool-graph/mempool-graph.component';
import { LbtcPegsGraphComponent } from '../components/lbtc-pegs-graph/lbtc-pegs-graph.component';
import { GraphsComponent } from '../components/graphs/graphs.component';
import { StatisticsComponent } from '../components/statistics/statistics.component';
import { MempoolBlockComponent } from '../components/mempool-block/mempool-block.component';
import { PoolRankingComponent } from '../components/pool-ranking/pool-ranking.component';
import { PoolComponent } from '../components/pool/pool.component';
import { TelevisionComponent } from '../components/television/television.component';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { MiningDashboardComponent } from '../components/mining-dashboard/mining-dashboard.component';
import { HashrateChartComponent } from '../components/hashrate-chart/hashrate-chart.component';
import { HashrateChartPoolsComponent } from '../components/hashrates-chart-pools/hashrate-chart-pools.component';
import { CommonModule } from '@angular/common';

@NgModule({
  declarations: [
    DashboardComponent,
    MempoolBlockComponent,

    MiningDashboardComponent,
    PoolComponent,
    PoolRankingComponent,
    TelevisionComponent,

    StatisticsComponent,
    GraphsComponent,
    BlockFeesGraphComponent,
    BlockRewardsGraphComponent,
    BlockFeeRatesGraphComponent,
    BlockSizesWeightsGraphComponent,
    FeeDistributionGraphComponent,
    IncomingTransactionsGraphComponent,
    MempoolGraphComponent,
    LbtcPegsGraphComponent,
    HashrateChartComponent,
    HashrateChartPoolsComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    GraphsRoutingModule,
    NgxEchartsModule.forRoot({
      echarts: () => import('echarts')
    })
  ]
})
export class GraphsModule { }
