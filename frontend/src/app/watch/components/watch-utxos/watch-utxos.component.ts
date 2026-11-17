import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
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

  ngOnChanges(): void {
    this.graphUtxos = this.toGraphUtxos(this.view);
  }

  trackByOutpoint(_: number, utxo: WalletUtxo): string {
    return `${utxo.txid}:${utxo.vout}`;
  }

  // The chart colours outputs by age from the funding tx's status, copied because the chart writes to it.
  // Every UTXO comes from view.transactions (buildWalletView), so its funding tx is always there.
  private toGraphUtxos(view: WalletView): Utxo[] {
    const statusByTxid = new Map(view.transactions.map((tx) => [tx.txid, tx.status]));
    return view.utxos.map((u) => ({ txid: u.txid, vout: u.vout, value: u.value, status: { ...statusByTxid.get(u.txid) } }));
  }
}
