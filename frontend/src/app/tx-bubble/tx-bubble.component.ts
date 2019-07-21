import { Component, OnInit, Input, OnChanges } from '@angular/core';
import { ITransaction } from '../blockchain/interfaces';

@Component({
  selector: 'app-tx-bubble',
  templateUrl: './tx-bubble.component.html',
  styleUrls: ['./tx-bubble.component.scss']
})
export class TxBubbleComponent implements OnChanges {
  @Input() tx: ITransaction | null = null;
  @Input() txTrackingBlockHeight = 0;
  @Input() latestBlockHeight = 0;
  @Input() arrowPosition: 'top' | 'right' | 'bottom' | 'top-right' | 'top-left' = 'top';

  txIdShort = '';
  confirmations = 0;

  constructor() { }

  ngOnChanges() {
    if (this.tx) {
      this.txIdShort = this.tx.txid.substring(0, 6) + '...' + this.tx.txid.substring(this.tx.txid.length - 6);
    }
    this.confirmations = (this.latestBlockHeight - this.txTrackingBlockHeight) + 1;
  }
}
