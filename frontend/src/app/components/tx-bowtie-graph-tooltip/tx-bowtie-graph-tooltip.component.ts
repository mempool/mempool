import { Component, ElementRef, ViewChild, Input, OnChanges, OnInit } from '@angular/core';
import { Subscription, of, switchMap, tap } from 'rxjs';
import { Price, PriceService } from '@app/services/price.service';
import { StateService } from '@app/services/state.service';
import { ApiService } from '@app/services/api.service';
import { environment } from '@environments/environment';

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
  blockHeight?: number;
  status?: any;
  spent?: boolean;
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
  blockConversions: { [timestamp: number]: Price } = {};
  inputStatus: { [index: number]: any } = {};
  currency: string;
  viewFiat: boolean;
  chainTip: number;
  currencyChangeSubscription: Subscription;
  viewFiatSubscription: Subscription;
  chainTipSubscription: Subscription;

  nativeAssetId = this.stateService.network === 'liquidtestnet' ? environment.nativeTestAssetId : environment.nativeAssetId;

  @ViewChild('tooltip') tooltipElement: ElementRef<HTMLCanvasElement>;

  constructor(
    private priceService: PriceService,
    private stateService: StateService,
    private apiService: ApiService,
  ) {}

  ngOnInit(): void {
    this.currencyChangeSubscription = this.stateService.fiatCurrency$.subscribe(currency => {
      this.currency = currency;
      this.blockConversions = {};
      this.inputStatus = {};
    });
    this.viewFiatSubscription = this.stateService.viewAmountMode$.subscribe(viewFiat => this.viewFiat = viewFiat === 'fiat');
    this.chainTipSubscription = this.stateService.chainTip$.subscribe(tip => this.chainTip = tip);
  }

  ngOnChanges(changes): void {
    if (changes.line?.currentValue) {
      if (changes.line.currentValue.type === 'input') {
        if (!this.inputStatus[changes.line.currentValue.index]) {
          if (changes.line.currentValue.txid) {
            this.apiService.getTransactionStatus$(changes.line.currentValue.txid).pipe(
              tap((status) => {
                changes.line.currentValue.status = status;
                this.inputStatus[changes.line.currentValue.index] = status;
                this.fetchPrices(changes);
              })
            ).subscribe();
          }
        } else {
          changes.line.currentValue.status = this.inputStatus[changes.line.currentValue.index];
          this.fetchPrices(changes);
        }
      } else {
        this.fetchPrices(changes);
      }
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

  fetchPrices(changes: any) {
    if (!this.currency || !this.viewFiat) return;
    if (this.isConnector) { // If the tooltip is on a connector, we fetch prices at the time of the input / output
      if (['input', 'output'].includes(changes.line.currentValue.type) && changes.line.currentValue?.status?.block_time && !this.blockConversions?.[changes.line.currentValue?.status.block_time]) {
        this.priceService.getBlockPrice$(changes.line.currentValue?.status.block_time, true, this.currency).pipe(
          tap((price) => this.blockConversions[changes.line.currentValue.status.block_time] = price),
        ).subscribe();
      }
    } else { // If the tooltip is on the transaction itself, we fetch prices at the time of the transaction
      if (changes.line.currentValue.timestamp && !this.blockConversions[changes.line.currentValue.timestamp]) {
        if (changes.line.currentValue.timestamp) {
          this.priceService.getBlockPrice$(changes.line.currentValue.timestamp, true, this.currency).pipe(
            tap((price) => this.blockConversions[changes.line.currentValue.timestamp] = price),
          ).subscribe();
        }
      } 
    }
  }

  pow(base: number, exponent: number): number {
    return Math.pow(base, exponent);
  }

  ngOnDestroy(): void {
    this.currencyChangeSubscription?.unsubscribe();
    this.viewFiatSubscription?.unsubscribe();
    this.chainTipSubscription?.unsubscribe();
  }
}
