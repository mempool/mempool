import { NgModule } from '@angular/core';
import { NgxEchartsModule } from 'ngx-echarts';
import { GraphsRoutingModule } from '@app/graphs/graphs.routing.module';
import { SharedModule } from '@app/shared/shared.module';

import { AccelerationFeesGraphComponent } from '@components/acceleration/acceleration-fees-graph/acceleration-fees-graph.component';
import { BlockFeesGraphComponent } from '@components/block-fees-graph/block-fees-graph.component';
import { BlockFeesSubsidyGraphComponent } from '@components/block-fees-subsidy-graph/block-fees-subsidy-graph.component';
import { BlockRewardsGraphComponent } from '@components/block-rewards-graph/block-rewards-graph.component';
import { BlockFeeRatesGraphComponent } from '@components/block-fee-rates-graph/block-fee-rates-graph.component';
import { BlockSizesWeightsGraphComponent } from '@components/block-sizes-weights-graph/block-sizes-weights-graph.component';
import { FeeDistributionGraphComponent } from '@components/fee-distribution-graph/fee-distribution-graph.component';
import { IncomingTransactionsGraphComponent } from '@components/incoming-transactions-graph/incoming-transactions-graph.component';
import { MempoolGraphComponent } from '@components/mempool-graph/mempool-graph.component';
import { LbtcPegsGraphComponent } from '@components/lbtc-pegs-graph/lbtc-pegs-graph.component';
import { ReservesSupplyStatsComponent } from '@components/liquid-reserves-audit/reserves-supply-stats/reserves-supply-stats.component';
import { ExpiredUtxosStatsComponent } from '@components/liquid-reserves-audit/expired-utxos-stats/expired-utxos-stats.component';
import { ReservesRatioStatsComponent } from '@components/liquid-reserves-audit/reserves-ratio-stats/reserves-ratio-stats.component';
import { ReservesRatioComponent } from '@components/liquid-reserves-audit/reserves-ratio/reserves-ratio.component';
import { RecentPegsStatsComponent } from '@components/liquid-reserves-audit/recent-pegs-stats/recent-pegs-stats.component';
import { RecentPegsListComponent } from '@components/liquid-reserves-audit/recent-pegs-list/recent-pegs-list.component';
import { FederationAddressesStatsComponent } from '@components/liquid-reserves-audit/federation-addresses-stats/federation-addresses-stats.component';
import { FederationAddressesListComponent } from '@components/liquid-reserves-audit/federation-addresses-list/federation-addresses-list.component';
import { GraphsComponent } from '@components/graphs/graphs.component';
import { StatisticsComponent } from '@components/statistics/statistics.component';
import { MempoolBlockComponent } from '@components/mempool-block/mempool-block.component';
import { PoolRankingComponent } from '@components/pool-ranking/pool-ranking.component';
import { PoolComponent } from '@components/pool/pool.component';
import { TelevisionComponent } from '@components/television/television.component';
import { DashboardComponent } from '@app/dashboard/dashboard.component';
import { CustomDashboardComponent } from '@components/custom-dashboard/custom-dashboard.component';
import { MiningDashboardComponent } from '@components/mining-dashboard/mining-dashboard.component';
import { AcceleratorDashboardComponent } from '@components/acceleration/accelerator-dashboard/accelerator-dashboard.component';
import { HashrateChartComponent } from '@components/hashrate-chart/hashrate-chart.component';
import { HashrateChartPoolsComponent } from '@components/hashrates-chart-pools/hashrate-chart-pools.component';
import { BlockHealthGraphComponent } from '@components/block-health-graph/block-health-graph.component';
import { AddressComponent } from '@components/address/address.component';
import { WalletComponent } from '@components/wallet/wallet.component';
import { WalletPreviewComponent } from '@components/wallet/wallet-preview.component';
import { AddressGraphComponent } from '@components/address-graph/address-graph.component';
import { UtxoGraphComponent } from '@components/utxo-graph/utxo-graph.component';
import { ActiveAccelerationBox } from '@components/acceleration/active-acceleration-box/active-acceleration-box.component';
import { AddressesTreemap } from '@components/addresses-treemap/addresses-treemap.component';
import { CommonModule } from '@angular/common';

@NgModule({
  declarations: [
    DashboardComponent,
    CustomDashboardComponent,
    MempoolBlockComponent,
    AddressComponent,
    WalletComponent,
    WalletPreviewComponent,

    MiningDashboardComponent,
    AcceleratorDashboardComponent,
    PoolComponent,
    PoolRankingComponent,
    TelevisionComponent,

    StatisticsComponent,
    GraphsComponent,
    AccelerationFeesGraphComponent,
    BlockFeesGraphComponent,
    BlockFeesSubsidyGraphComponent,
    BlockRewardsGraphComponent,
    BlockFeeRatesGraphComponent,
    BlockSizesWeightsGraphComponent,
    FeeDistributionGraphComponent,
    IncomingTransactionsGraphComponent,
    MempoolGraphComponent,
    LbtcPegsGraphComponent,
    ReservesSupplyStatsComponent,
    ExpiredUtxosStatsComponent,
    ReservesRatioStatsComponent,
    ReservesRatioComponent,
    RecentPegsStatsComponent,
    RecentPegsListComponent,
    FederationAddressesStatsComponent,
    FederationAddressesListComponent,
    HashrateChartComponent,
    HashrateChartPoolsComponent,
    BlockHealthGraphComponent,
    AddressGraphComponent,
    UtxoGraphComponent,
    ActiveAccelerationBox,
    AddressesTreemap,
  ],
  imports: [
    CommonModule,
    SharedModule,
    GraphsRoutingModule,
    NgxEchartsModule.forRoot({
      echarts: () => import('@app/graphs/echarts').then(m => m.echarts),
    })
  ],
  exports: [
    NgxEchartsModule,
    ActiveAccelerationBox,
  ]
})
export class GraphsModule { }
