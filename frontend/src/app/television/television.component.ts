import { Component, OnInit, OnDestroy, Renderer2, HostListener, LOCALE_ID, Inject } from '@angular/core';
import { IMempoolDefaultResponse, IBlock, IProjectedBlock, ITransaction } from './interfaces';
import { retryWhen, switchMap, tap } from 'rxjs/operators';
import { MemPoolService } from '../services/mem-pool.service';
import { ApiService } from '../services/api.service';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BlockModalComponent } from '../block-modal/block-modal.component';
import { ProjectedBlockModalComponent } from '../projected-block-modal/projected-block-modal.component';
import { formatDate } from '@angular/common';
import { BytesPipe } from '../shared/pipes/bytes-pipe/bytes.pipe';
import * as Chartist from 'chartist';
import { FormGroup, FormBuilder } from '@angular/forms';
import { IMempoolStats } from '../blockchain/interfaces';
import { Subject, of, merge} from 'rxjs';

@Component({
  selector: 'app-television',
  templateUrl: './television.component.html',
  styleUrls: [
    '../statistics/chartist.component.scss',
    '../statistics/statistics.component.scss',
    './television.component.scss'
  ]
})
export class TelevisionComponent implements OnInit, OnDestroy {
  blocks: IBlock[] = [];
  projectedBlocks: IProjectedBlock[] = [];
  subscription: any;
  socket: any;
  innerWidth: any;
  txBubbleStyle: any = {};

  txTrackingLoading = false;
  txTrackingEnabled = false;
  txTrackingTx: ITransaction | null = null;
  txTrackingBlockHeight = 0;
  txShowTxNotFound = false;
  txBubbleArrowPosition = 'top';

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.innerWidth = window.innerWidth;
    this.moveTxBubbleToPosition();
  }

  constructor(
    private memPoolService: MemPoolService,
    private apiService: ApiService,
    private renderer: Renderer2,
    private route: ActivatedRoute,
    private modalService: NgbModal,
    @Inject(LOCALE_ID) private locale: string,
    private bytesPipe: BytesPipe,
    private formBuilder: FormBuilder,
  ) {
    this.radioGroupForm = this.formBuilder.group({
      'dateSpan': '2h'
    });
   }

  ngOnInit() {

    this.txBubbleStyle = {
      'position': 'absolute',
      'top': '425px',
      'visibility': 'hidden',
    };

    this.innerWidth = window.innerWidth;
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

    const now = new Date();
    const nextInterval = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(),
      Math.floor(now.getMinutes() / 1) * 1 + 1, 0, 0);
    const difference = nextInterval.getTime() - now.getTime();

    setTimeout(() => {
      setInterval(() => {
        if (this.radioGroupForm.controls['dateSpan'].value === '2h') {
          this.reloadData$.next();
        }
      }, 60 * 1000);
    }, difference + 1000); // Next whole minute + 1 second

    const labelInterpolationFnc = (value: any, index: any) => {
      const nr = 6;

      switch (this.radioGroupForm.controls['dateSpan'].value) {
        case '2h':
        case '24h':
          value = formatDate(value, 'HH:mm', this.locale);
          break;
        case '1w':
          value = formatDate(value, 'dd/MM HH:mm', this.locale);
          break;
        case '1m':
        case '3m':
        case '6m':
          value = formatDate(value, 'dd/MM', this.locale);
      }

      return index % nr  === 0 ? value : null;
    };

    this.mempoolVsizeFeesOptions = {
      showArea: true,
      showLine: false,
      fullWidth: true,
      showPoint: false,
      low: 0,
      axisX: {
        labelInterpolationFnc: labelInterpolationFnc,
        offset: 40
      },
      axisY: {
        labelInterpolationFnc: (value: number): any => {
          return this.bytesPipe.transform(value);
        },
        offset: 160
      },
      plugins: [
        Chartist.plugins.ctTargetLine({
          value: 1000000
        }),
        Chartist.plugins.legend({
          legendNames: [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200,
            250, 300, 350, 400, 500, 600].map((sats, i, arr) => {
              if (sats === 600) {
               return '500+';
              }
              if (i === 0) {
                return '1 sat/vbyte';
              }
              return arr[i - 1] + ' - ' + sats;
            })
        })
      ]
    };

    this.transactionsWeightPerSecondOptions = {
      showArea: false,
      showLine: true,
      showPoint: false,
      low: 0,
      axisY: {
        offset: 40
      },
      axisX: {
        labelInterpolationFnc: labelInterpolationFnc
      },
      plugins: [
        Chartist.plugins.ctTargetLine({
          value: 1667
        }),
      ]
    };

    this.transactionsPerSecondOptions = {
      showArea: false,
      showLine: true,
      showPoint: false,
      low: 0,
      axisY: {
        offset: 40
      },
      axisX: {
        labelInterpolationFnc: labelInterpolationFnc
      },
    };

    this.route
      .fragment
      .subscribe((fragment) => {
        if (['2h', '24h', '1w', '1m', '3m', '6m'].indexOf(fragment) > -1) {
          this.radioGroupForm.controls['dateSpan'].setValue(fragment);
        }
      });

    merge(
      of(''),
      this.reloadData$,
      this.radioGroupForm.controls['dateSpan'].valueChanges
        .pipe(
          tap(() => {
            this.mempoolStats = [];
          })
        )
    )
    .pipe(
      switchMap(() => {
        this.spinnerLoading = true;
        if (this.radioGroupForm.controls['dateSpan'].value === '6m') {
          return this.apiService.list6MStatistics$();
        }
        if (this.radioGroupForm.controls['dateSpan'].value === '3m') {
          return this.apiService.list3MStatistics$();
        }
        if (this.radioGroupForm.controls['dateSpan'].value === '1m') {
          return this.apiService.list1MStatistics$();
        }
        if (this.radioGroupForm.controls['dateSpan'].value === '1w') {
          return this.apiService.list1WStatistics$();
        }
        if (this.radioGroupForm.controls['dateSpan'].value === '24h') {
          return this.apiService.list24HStatistics$();
        }
        if (this.radioGroupForm.controls['dateSpan'].value === '2h' && !this.mempoolStats.length) {
          return this.apiService.list2HStatistics$();
        }
        const lastId = this.mempoolStats[0].id;
        return this.apiService.listLiveStatistics$(lastId);
      })
    )
    .subscribe((mempoolStats) => {
      let hasChange = false;
      if (this.radioGroupForm.controls['dateSpan'].value === '2h' && this.mempoolStats.length) {
        if (mempoolStats.length) {
          this.mempoolStats = mempoolStats.concat(this.mempoolStats);
          this.mempoolStats = this.mempoolStats.slice(0, this.mempoolStats.length - mempoolStats.length);
          hasChange = true;
        }
      } else {
        this.mempoolStats = mempoolStats;
        hasChange = true;
      }
      if (hasChange) {
        this.handleNewMempoolData(this.mempoolStats.concat([]));
      }
      this.loading = false;
      this.spinnerLoading = false;
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
      if (this.innerWidth <= 768) {
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

  getTimeSinceMined(block: IBlock): string {
    const minutes = ((new Date().getTime()) - (new Date(block.time * 1000).getTime())) / 1000 / 60;
    if (minutes >= 120) {
      return Math.floor(minutes / 60) + ' hours';
    }
    if (minutes >= 60) {
      return Math.floor(minutes / 60) + ' hour';
    }
    if (minutes <= 1) {
      return '< 1 minute';
    }
    if (minutes === 1) {
      return '1 minute';
    }
    return Math.round(minutes) + ' minutes';
  }

  getStyleForBlock(block: IBlock) {
    const greenBackgroundHeight = 100 - (block.weight / 4000000) * 100;
    if (this.innerWidth <= 768) {
      return {
        'top': 155 * this.blocks.indexOf(block) + 'px',
        'background': `repeating-linear-gradient(#2d3348, #2d3348 ${greenBackgroundHeight}%,
          #9339f4 ${Math.max(greenBackgroundHeight, 0)}%, #105fb0 100%)`,
      };
    } else {
      return {
        'left': 155 * this.blocks.indexOf(block) + 'px',
        'background': `repeating-linear-gradient(#2d3348, #2d3348 ${greenBackgroundHeight}%,
          #9339f4 ${Math.max(greenBackgroundHeight, 0)}%, #105fb0 100%)`,
      };
    }
  }

  getStyleForProjectedBlockAtIndex(index: number) {
    const greenBackgroundHeight = 100 - (this.projectedBlocks[index].blockWeight / 4000000) * 100;
    if (this.innerWidth <= 768) {
      if (index === 3) {
        return {
          'top': 40 + index * 155 + 'px'
        };
      }
      return {
        'top': 40 + index * 155 + 'px',
        'background': `repeating-linear-gradient(#554b45, #554b45 ${greenBackgroundHeight}%,
          #bd7c13 ${Math.max(greenBackgroundHeight, 0)}%, #c5345a 100%)`,
      };
    } else {
      if (index === 3) {
        return {
          'right': 40 + index * 155 + 'px'
        };
      }
      return {
        'right': 40 + index * 155 + 'px',
        'background': `repeating-linear-gradient(#554b45, #554b45 ${greenBackgroundHeight}%,
          #bd7c13 ${Math.max(greenBackgroundHeight, 0)}%, #c5345a 100%)`,
      };
    }
  }

  trackByProjectedFn(index: number) {
    return index;
  }

  trackByBlocksFn(index: number, item: IBlock) {
    return item.height;
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    this.renderer.removeClass(document.body, 'disable-scroll');
  }

  openBlockModal(block: IBlock) {
    const modalRef = this.modalService.open(BlockModalComponent, { size: 'lg' });
    modalRef.componentInstance.block = block;
  }

  openProjectedBlockModal(block: IBlock, index: number) {
    const modalRef = this.modalService.open(ProjectedBlockModalComponent, { size: 'lg' });
    modalRef.componentInstance.block = block;
    modalRef.componentInstance.index = index;
  }

  loading = true;
  spinnerLoading = false;

  mempoolStats: IMempoolStats[] = [];

  mempoolVsizeFeesData: any;
  mempoolUnconfirmedTransactionsData: any;
  mempoolTransactionsPerSecondData: any;
  mempoolTransactionsWeightPerSecondData: any;

  mempoolVsizeFeesOptions: any;
  transactionsPerSecondOptions: any;
  transactionsWeightPerSecondOptions: any;

  radioGroupForm: FormGroup;

  reloadData$: Subject<any> = new Subject();

  handleNewMempoolData(mempoolStats: IMempoolStats[]) {
    mempoolStats.reverse();
    const labels = mempoolStats.map(stats => stats.added);

    /** Active admins summed up */

    this.mempoolTransactionsPerSecondData = {
      labels: labels,
      series: [mempoolStats.map((stats) => stats.tx_per_second)],
    };

    this.mempoolTransactionsWeightPerSecondData = {
      labels: labels,
      series: [mempoolStats.map((stats) => stats.vbytes_per_second)],
    };

    const finalArrayVbyte = this.generateArray(mempoolStats);

    // Remove the 0-1 fee vbyte since it's practially empty
    finalArrayVbyte.shift();

    this.mempoolVsizeFeesData = {
      labels: labels,
      series: finalArrayVbyte
    };
  }

  getTimeToNextTenMinutes(): number {
    const now = new Date();
    const nextInterval = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(),
      Math.floor(now.getMinutes() / 10) * 10 + 10, 0, 0);
    return nextInterval.getTime() - now.getTime();
  }

  generateArray(mempoolStats: IMempoolStats[]) {
    const logFees = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200,
      250, 300, 350, 400, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000];

    logFees.reverse();

    const finalArray: number[][] = [];
    let feesArray: number[] = [];

    logFees.forEach((fee) => {
      feesArray = [];
      mempoolStats.forEach((stats) => {
        // @ts-ignore
        const theFee = stats['vsize_' + fee];
        if (theFee) {
          feesArray.push(parseInt(theFee, 10));
        } else {
          feesArray.push(0);
        }
      });
      if (finalArray.length) {
        feesArray = feesArray.map((value, i) => value + finalArray[finalArray.length - 1][i]);
      }
      finalArray.push(feesArray);
    });
    finalArray.reverse();
    return finalArray;
  }
}
