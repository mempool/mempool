import { Component, ElementRef, ViewChild, Input, OnChanges, ChangeDetectionStrategy } from '@angular/core';
import { TransactionStripped } from '../../interfaces/websocket.interface';

interface Xput {
  type: 'input' | 'output' | 'fee';
  value?: number;
  index?: number;
  address?: string;
  rest?: number;
  coinbase?: boolean;
  pegin?: boolean;
  pegout?: string;
  confidential?: boolean;
}

@Component({
  selector: 'app-tx-bowtie-graph-tooltip',
  templateUrl: './tx-bowtie-graph-tooltip.component.html',
  styleUrls: ['./tx-bowtie-graph-tooltip.component.scss'],
})
export class TxBowtieGraphTooltipComponent implements OnChanges {
  @Input() line: Xput | void;
  @Input() cursorPosition: { x: number, y: number };

  tooltipPosition = { x: 0, y: 0 };

  @ViewChild('tooltip') tooltipElement: ElementRef<HTMLCanvasElement>;

  constructor() {}

  ngOnChanges(changes): void {
    if (changes.cursorPosition && changes.cursorPosition.currentValue) {
      let x = Math.max(10, changes.cursorPosition.currentValue.x - 50);
      let y = changes.cursorPosition.currentValue.y + 20;
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
  }
}
