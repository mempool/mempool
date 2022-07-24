import { Component, ChangeDetectionStrategy, OnChanges, Input } from '@angular/core';
import { calcSegwitFeeGains } from 'src/app/bitcoin.utils';
import { Transaction } from 'src/app/interfaces/electrs.interface';

@Component({
  selector: 'app-tx-features',
  templateUrl: './tx-features.component.html',
  styleUrls: ['./tx-features.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TxFeaturesComponent implements OnChanges {
  @Input() tx: Transaction;

  segwitGains = {
    realizedBech32Gains: 0,
    potentialBech32Gains: 0,
    potentialP2shGains: 0,
    potentialTaprootGains: 0,
    realizedTaprootGains: 0
  };
  isRbfTransaction: boolean;
  isTaproot: boolean;

  constructor() { }

  ngOnChanges() {
    if (!this.tx) {
      return;
    }
    this.segwitGains = calcSegwitFeeGains(this.tx);
    this.isRbfTransaction = this.tx.vin.some((v) => v.sequence < 0xfffffffe);
    this.isTaproot = this.tx.vin.some((v) => v.prevout && v.prevout.scriptpubkey_type === 'v1_p2tr');
  }
}
