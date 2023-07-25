import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, Input, Output, EventEmitter, HostListener, ChangeDetectorRef } from '@angular/core';
import { firstValueFrom, Subscription } from 'rxjs';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-blockchain',
  templateUrl: './blockchain.component.html',
  styleUrls: ['./blockchain.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockchainComponent implements OnInit, OnDestroy {
  @Input() pages: any[] = [];
  @Input() pageIndex: number;
  @Input() blocksPerPage: number = 8;
  @Input() minScrollWidth: number = 0;
  @Input() scrollableMempool: boolean = false;

  @Output() mempoolOffsetChange: EventEmitter<number> = new EventEmitter();

  network: string;
  timeLtrSubscription: Subscription;
  timeLtr: boolean = this.stateService.timeLtr.value;
  ltrTransitionEnabled = false;
  flipping = false;
  connectionStateSubscription: Subscription;
  loadingTip: boolean = true;
  connected: boolean = true;

  dividerOffset: number = 0;
  mempoolOffset: number = 0;

  constructor(
    public stateService: StateService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.onResize();
    this.network = this.stateService.network;
    this.timeLtrSubscription = this.stateService.timeLtr.subscribe((ltr) => {
      this.timeLtr = !!ltr;
    });
    this.connectionStateSubscription = this.stateService.connectionState$.subscribe(state => {
      this.connected = (state === 2);
    });
    firstValueFrom(this.stateService.chainTip$).then(() => {
      this.loadingTip = false;
    });
  }

  ngOnDestroy(): void {
    this.timeLtrSubscription.unsubscribe();
    this.connectionStateSubscription.unsubscribe();
  }

  trackByPageFn(index: number, item: { index: number }): number {
    return item.index;
  }

  toggleTimeDirection(): void {
    this.ltrTransitionEnabled = false;
    const prevOffset = this.mempoolOffset;
    this.mempoolOffset = 0;
    this.mempoolOffsetChange.emit(0);
    setTimeout(() => {
      this.ltrTransitionEnabled = true;
      this.flipping = true;
      this.stateService.timeLtr.next(!this.timeLtr);
      setTimeout(() => {
        this.ltrTransitionEnabled = false;
        this.flipping = false;
        this.mempoolOffset = prevOffset;
        this.mempoolOffsetChange.emit(this.mempoolOffset);
      },  1000);
    }, 0);
    this.cd.markForCheck();
  }

  onMempoolWidthChange(width): void {
    if (this.flipping) {
      return;
    }
    this.mempoolOffset = Math.max(0, width - this.dividerOffset);
    this.cd.markForCheck();
    this.mempoolOffsetChange.emit(this.mempoolOffset);
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    if (window.innerWidth >= 768) {
      if (this.stateService.isLiquid()) {
        this.dividerOffset = 420;
      } else {
        this.dividerOffset = window.innerWidth * 0.5;
      }
    } else {
      if (this.stateService.isLiquid()) {
        this.dividerOffset = window.innerWidth * 0.5;
      } else {
        this.dividerOffset = window.innerWidth * 0.95;
      }
    }
    this.cd.markForCheck();
  }
}
