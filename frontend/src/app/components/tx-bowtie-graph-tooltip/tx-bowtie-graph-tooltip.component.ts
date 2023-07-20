import { Component, ElementRef, ViewChild, Input, OnChanges, OnInit } from '@angular/core';
import { tap } from 'rxjs';
import { Price, PriceService } from '../../services/price.service';
import { StateService } from '../../services/state.service';
import { environment } from '../../../environments/environment';

interface Xput {
  type: 'input' | 'output' | 'fee';
  value?: number;
  displayValue?: number;
  index?: number;
  txid?: string;
  vin?: number;
  vout?: number;
  address?: string;
  rest?: number;
  coinbase?: boolean;
  pegin?: boolean;
  pegout?: string;
  confidential?: boolean;
  timestamp?: number;
  asset?: string;
}

@Component({
  selector: 'app-tx-bowtie-graph-tooltip',
  templateUrl: './tx-bowtie-graph-tooltip.component.html',
  styleUrls: ['./tx-bowtie-graph-tooltip.component.scss'],
})
export class TxBowtieGraphTooltipComponent implements OnChanges {
  @Input() line: Xput | void;
  @Input() cursorPosition: { x: number, y: number };
  @Input() isConnector: boolean = false;
  @Input() assetsMinimal: any;

  tooltipPosition = { x: 0, y: 0 };
  blockConversion: Price;

  nativeAssetId = this.stateService.network === 'liquidtestnet' ? environment.nativeTestAssetId : environment.nativeAssetId;

  @ViewChild('tooltip') tooltipElement: ElementRef<HTMLCanvasElement>;

  constructor(
    private priceService: PriceService,
    private stateService: StateService,
  ) {}

  ngOnChanges(changes): void {
    if (changes.line?.currentValue) {
      this.priceService.getBlockPrice$(changes.line?.currentValue.timestamp, true).pipe(
        tap((price) => {
          this.blockConversion = price;
        })
      ).subscribe();
    }

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

  pow(base: number, exponent: number): number {
    return Math.pow(base, exponent);
  }
}
