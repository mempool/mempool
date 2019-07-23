import { Component, OnInit, OnDestroy, Renderer2, HostListener } from '@angular/core';
import { IMempoolDefaultResponse, IBlock, IProjectedBlock, ITransaction } from './interfaces';
import { retryWhen, tap } from 'rxjs/operators';
import { MemPoolService } from '../services/mem-pool.service';
import { ApiService } from '../services/api.service';
import { ActivatedRoute, ParamMap } from '@angular/router';

@Component({
  selector: 'app-blockchain',
  templateUrl: './blockchain.component.html',
  styleUrls: ['./blockchain.component.scss']
})
export class BlockchainComponent implements OnInit, OnDestroy {
  blocks: IBlock[] = [];
  projectedBlocks: IProjectedBlock[] = [];
  subscription: any;
  socket: any;
  txBubbleStyle: any = {};

  txTrackingLoading = false;
  txTrackingEnabled = false;
  txTrackingTx: ITransaction | null = null;
  txTrackingBlockHeight = 0;
  txShowTxNotFound = false;
  txBubbleArrowPosition = 'top';

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.moveTxBubbleToPosition();
  }

  constructor(
    private memPoolService: MemPoolService,
    private apiService: ApiService,
    private renderer: Renderer2,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {

    this.txBubbleStyle = {
      'position': 'absolute',
      'top': '425px',
      'visibility': 'hidden',
    };
    this.socket = this.apiService.websocketSubject;
    this.subscription = this.socket
      .pipe(
        retryWhen((errors: any) => errors.pipe(
        tap(() => this.memPoolService.isOffline.next(true))))
      )
      .subscribe((response: IMempoolDefaultResponse) => {
        this.memPoolService.isOffline.next(false);
        if (response.mempoolInfo && response.txPerSecond !== undefined) {
          this.memPoolService.loaderSubject.next({
            memPoolInfo: response.mempoolInfo,
            txPerSecond: response.txPerSecond,
            vBytesPerSecond: response.vBytesPerSecond,
          });
        }
        if (response.blocks && response.blocks.length) {
          this.blocks = response.blocks;
          this.blocks.reverse();
        }
        if (response.block) {
          if (!this.blocks.some((block) => response.block !== undefined && response.block.height === block.height )) {
            this.blocks.unshift(response.block);
            if (this.blocks.length >= 8) {
              this.blocks.pop();
            }
          }
        }
        if (response.conversions) {
          this.memPoolService.conversions.next(response.conversions);
        }
        if (response.projectedBlocks) {
          this.projectedBlocks = response.projectedBlocks;
          const mempoolWeight = this.projectedBlocks.map((block) => block.blockWeight).reduce((a, b) => a + b);
          this.memPoolService.mempoolWeight.next(mempoolWeight);
        }
        if (response['track-tx']) {
          if (response['track-tx'].tracking) {
            this.txTrackingEnabled = true;
            this.txTrackingBlockHeight = response['track-tx'].blockHeight;
            if (response['track-tx'].tx) {
              this.txTrackingTx = response['track-tx'].tx;
              this.txTrackingLoading = false;
            }
          } else {
            this.txTrackingEnabled = false;
            this.txTrackingTx = null;
            this.txTrackingBlockHeight = 0;
          }
          if (response['track-tx'].message && response['track-tx'].message === 'not-found') {
            this.txTrackingLoading = false;
            this.txShowTxNotFound = true;
            setTimeout(() => { this.txShowTxNotFound = false; }, 2000);
          }
          setTimeout(() => {
            this.moveTxBubbleToPosition();
          });
        }
      },
      (err: Error) => console.log(err)
    );
    this.renderer.addClass(document.body, 'disable-scroll');

    this.route.paramMap
      .subscribe((params: ParamMap) => {
        const txId: string | null = params.get('id');
        if (!txId) {
          return;
        }
        this.txTrackingLoading = true;
        this.socket.next({'action': 'track-tx', 'txId': txId});
      });

    this.memPoolService.txIdSearch
      .subscribe((txId) => {
        if (txId) {
          this.txTrackingLoading = true;
          this.socket.next({'action': 'track-tx', 'txId': txId});
        }
      });
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
        this.txBubbleStyle['top'] = '425px';
      }
    } else {
      this.txBubbleArrowPosition = 'top';
      const domRect: DOMRect | ClientRect = element.getBoundingClientRect();
      this.txBubbleStyle['left'] = domRect.left - 50 + 'px';
      this.txBubbleStyle['top'] = domRect.top + 125 + window.scrollY + 'px';

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

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    this.renderer.removeClass(document.body, 'disable-scroll');
  }
}
