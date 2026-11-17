import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { NgxEchartsModule } from 'ngx-echarts';
import { SharedModule } from '@app/shared/shared.module';
import { AddressGraphModule } from '@components/address-graph/address-graph.module';
import { UtxoGraphModule } from '@components/utxo-graph/utxo-graph.module';
import { WatchComponent } from '@app/watch/watch.component';
import { WatchImportComponent } from '@app/watch/components/watch-import/watch-import.component';
import { WatchSwitcherComponent } from '@app/watch/components/watch-switcher/watch-switcher.component';
import { WatchOverviewComponent } from '@app/watch/components/watch-overview/watch-overview.component';
import { WatchTransactionsComponent } from '@app/watch/components/watch-transactions/watch-transactions.component';
import { WatchUtxosComponent } from '@app/watch/components/watch-utxos/watch-utxos.component';
import { WatchAddressesComponent } from '@app/watch/components/watch-addresses/watch-addresses.component';
import { WatchSettingsComponent } from '@app/watch/components/watch-settings/watch-settings.component';
import { WatchScanStatusComponent } from '@app/watch/components/watch-scan-status/watch-scan-status.component';
import { DerivationService } from '@app/watch/services/derivation.service';
import { WalletScannerService } from '@app/watch/services/wallet-scanner.service';
import { WalletStorageService } from '@app/watch/services/wallet-storage.service';

const routes: Routes = [
  {
    path: '',
    component: WatchComponent,
  },
];

// Wallet services are provided here or by WatchComponent, never in root, so no other page bundles them.
@NgModule({
  declarations: [
    WatchComponent,
    WatchImportComponent,
    WatchSwitcherComponent,
    WatchOverviewComponent,
    WatchTransactionsComponent,
    WatchUtxosComponent,
    WatchAddressesComponent,
    WatchSettingsComponent,
    WatchScanStatusComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule,
    RouterModule.forChild(routes),
    AddressGraphModule,
    UtxoGraphModule,
    // echarts itself stays lazily imported; the chart chunk loads only when a chart renders.
    NgxEchartsModule.forRoot({
      echarts: () => import('@app/graphs/echarts').then(m => m.echarts),
    }),
  ],
  providers: [
    DerivationService,
    WalletScannerService,
    WalletStorageService,
  ],
})
export class WatchModule {}
