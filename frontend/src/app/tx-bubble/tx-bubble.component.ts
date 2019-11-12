import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ITransaction, IProjectedBlock } from '../blockchain/interfaces';
import { Subscription } from 'rxjs';
import { ITxTracking, MemPoolService } from '../services/mem-pool.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-tx-bubble',
  templateUrl: './tx-bubble.component.html',
  styleUrls: ['./tx-bubble.component.scss']
})
export class TxBubbleComponent implements OnInit, OnDestroy {
  tx: ITransaction | null = null;
  txTrackingBlockHeight = 0;
  latestBlockHeight = 0;
  txBubbleArrowPosition: 'top' | 'right' | 'bottom' | 'top-right' | 'top-left' = 'top';

  txTrackingSubscription: Subscription;
  projectedBlocksSubscription: Subscription;
  blocksSubscription: Subscription;

  projectedBlocks: IProjectedBlock[] = [];

  txIdShort = '';
  confirmations = 0;
  conversions: any;

  txBubbleStyle: any = {
    'position': 'absolute',
    'top': '425px',
    'visibility': 'hidden',
  };

  txTrackingLoading = false;
  txTrackingEnabled = false;
  txTrackingTx: ITransaction | null = null;
  txShowTxNotFound = false;

  isEsploraEnabled = !!environment.esplora;

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.moveTxBubbleToPosition();
  }

  constructor(
    private memPoolService: MemPoolService,
  ) { }

  ngOnInit() {
    this.txTrackingSubscription = this.memPoolService.txTracking$
      .subscribe((response: ITxTracking) => {
        this.txTrackingBlockHeight = response.blockHeight;
        this.txTrackingEnabled = response.enabled;
        if (response.tx) {
          this.tx = response.tx;
        }
        if (this.txTrackingEnabled) {
          setTimeout(() => this.moveTxBubbleToPosition());
        }
        if (this.txShowTxNotFound) {
          setTimeout(() => { this.txShowTxNotFound = false; }, 2000);
        }
        if (this.latestBlockHeight) {
          this.confirmations = (this.latestBlockHeight - this.txTrackingBlockHeight) + 1;
        }
      });

    this.projectedBlocksSubscription = this.memPoolService.projectedBlocks$
      .subscribe((projectedblocks) => this.projectedBlocks = projectedblocks);

    this.blocksSubscription = this.memPoolService.blocks$
      .subscribe((block) => {
        this.latestBlockHeight = block.height;
        if (this.txTrackingBlockHeight) {
          this.confirmations = (this.latestBlockHeight - this.txTrackingBlockHeight) + 1;
        }
        setTimeout(() => this.moveTxBubbleToPosition(), 1000);
      });

    this.memPoolService.conversions$
      .subscribe((conversions) => {
        this.conversions = conversions;
      });
  }

  ngOnDestroy() {
    this.projectedBlocksSubscription.unsubscribe();
    this.txTrackingSubscription.unsubscribe();
    this.blocksSubscription.unsubscribe();
  }

  moveTxBubbleToPosition() {
    let element: HTMLElement | null = null;
    if (this.txTrackingBlockHeight === 0) {
      const index = this.projectedBlocks.findIndex((pB) => pB.hasMytx);
      if (index > -1) {
        element = document.getElementById('projected-block-' + index);
      } else {
        return;
      }
    } else {
      element = document.getElementById('bitcoin-block-' + this.txTrackingBlockHeight);
    }

    this.txBubbleStyle['visibility'] = 'visible';
    this.txBubbleStyle['position'] = 'absolute';

    if (!element) {
      if (window.innerWidth <= 768) {
        this.txBubbleArrowPosition = 'bottom';
        this.txBubbleStyle['left'] = window.innerWidth / 2 - 50 + 'px';
        this.txBubbleStyle['bottom'] = '270px';
        this.txBubbleStyle['top'] = 'inherit';
        this.txBubbleStyle['position'] = 'fixed';
      } else {
        this.txBubbleStyle['left'] = window.innerWidth - 220 + 'px';
        this.txBubbleArrowPosition = 'right';
        this.txBubbleStyle['top'] = '460px';
      }
    } else {
      this.txBubbleArrowPosition = 'top';
      const domRect: DOMRect | ClientRect = element.getBoundingClientRect();
      this.txBubbleStyle['left'] = domRect.left - 50 + 'px';
      this.txBubbleStyle['top'] = domRect.top + 140 + window.scrollY + 'px';

      if (domRect.left + 100 > window.innerWidth) {
        this.txBubbleStyle['left'] = window.innerWidth - 220 + 'px';
        this.txBubbleArrowPosition = 'right';
      } else if (domRect.left + 220 > window.innerWidth) {
        this.txBubbleStyle['left'] = window.innerWidth - 240 + 'px';
        this.txBubbleArrowPosition = 'top-right';
      } else {
        this.txBubbleStyle['left'] = domRect.left + 15 + 'px';
      }

      if (domRect.left < 86) {
        this.txBubbleArrowPosition = 'top-left';
        this.txBubbleStyle['left'] = 125 + 'px';
      }
    }
  }
}
