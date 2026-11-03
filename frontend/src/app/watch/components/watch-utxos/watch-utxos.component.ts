import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { StateService } from '@app/services/state.service';
import { Utxo } from '@interfaces/electrs.interface';
import { WalletView } from '@app/watch/wallet-math';
import { WalletUtxo } from '@app/watch/watch.types';

@Component({
  selector: 'app-watch-utxos',
  templateUrl: './watch-utxos.component.html',
  styleUrls: ['./watch-utxos.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class WatchUtxosComponent implements OnChanges {
  @Input({ required: true }) view!: WalletView;

  /** Rebuilt only when the view changes: the OnPush chart re-packs on every new array. */
  graphUtxos: Utxo[] = [];

  constructor(private stateService: StateService) {}

  ngOnChanges(): void {
    this.graphUtxos = this.toGraphUtxos(this.view);
  }

  trackByOutpoint(_: number, utxo: WalletUtxo): string {
    return `${utxo.txid}:${utxo.vout}`;
  }

  // The chart colours outputs by age. Copy the funding tx's status (the chart writes to it),
  // or estimate the time from the height at ten minutes per block.
  private toGraphUtxos(view: WalletView): Utxo[] {
    const statusByTxid = new Map(view.transactions.map((tx) => [tx.txid, tx.status]));
    const tipHeight = this.stateService.latestBlockHeight;
    const now = Math.floor(Date.now() / 1000);
    return view.utxos.map((u) => {
      const status = statusByTxid.get(u.txid);
      if (status) {
        return { txid: u.txid, vout: u.vout, value: u.value, status: { ...status } };
      }
      const blockTime = u.confirmed && u.blockHeight && tipHeight > 0
        ? now - Math.max(0, tipHeight - u.blockHeight) * 600
        : undefined;
      return { txid: u.txid, vout: u.vout, value: u.value, status: { confirmed: u.confirmed, block_height: u.blockHeight, block_time: blockTime } };
    });
  }
}
