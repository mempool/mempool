import { Component, ElementRef, ViewChild, Input, OnChanges, ChangeDetectionStrategy } from '@angular/core';
import { TransactionStripped } from '../../interfaces/websocket.interface';
import { Position } from '../../components/block-overview-graph/sprite-types.js';

@Component({
  selector: 'app-block-overview-tooltip',
  templateUrl: './block-overview-tooltip.component.html',
  styleUrls: ['./block-overview-tooltip.component.scss'],
})
export class BlockOverviewTooltipComponent implements OnChanges {
  @Input() tx: TransactionStripped | void;
  @Input() cursorPosition: Position;
  @Input() clickable: boolean;

  txid = '';
  fee = 0;
  value = 0;
  vsize = 1;
  feeRate = 0;

  tooltipPosition: Position = { x: 0, y: 0 };

  @ViewChild('tooltip') tooltipElement: ElementRef<HTMLCanvasElement>;

  constructor() {}

  ngOnChanges(changes): void {
    if (changes.cursorPosition && changes.cursorPosition.currentValue) {
      let x = changes.cursorPosition.currentValue.x + 10;
      let y = changes.cursorPosition.currentValue.y + 10;
      if (this.tooltipElement) {
        const elementBounds = this.tooltipElement.nativeElement.getBoundingClientRect();
        const parentBounds = this.tooltipElement.nativeElement.offsetParent.getBoundingClientRect();
        if ((parentBounds.left + x + elementBounds.width) > parentBounds.right) {
          x = Math.max(0, parentBounds.width - elementBounds.width - 10);
        }
        if (y + elementBounds.height > parentBounds.height) {
          y = y - elementBounds.height - 20;
        }
      }
      this.tooltipPosition = { x, y };
    }

    if (changes.tx) {
      const tx = changes.tx.currentValue || {};
      this.txid = tx.txid || '';
      this.fee = tx.fee || 0;
      this.value = tx.value || 0;
      this.vsize = tx.vsize || 1;
      this.feeRate = this.fee / this.vsize;
    }
  }
}
