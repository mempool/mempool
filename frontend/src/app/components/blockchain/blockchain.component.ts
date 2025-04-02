import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, Input, Output, EventEmitter, ChangeDetectorRef, OnChanges, SimpleChanges } from '@angular/core';
import { firstValueFrom, Subscription } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { StorageService } from '@app/services/storage.service';

@Component({
  selector: 'app-blockchain',
  templateUrl: './blockchain.component.html',
  styleUrls: ['./blockchain.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockchainComponent implements OnInit, OnDestroy, OnChanges {
  @Input() pages: any[] = [];
  @Input() pageIndex: number;
  @Input() blocksPerPage: number = 8;
  @Input() minScrollWidth: number = 0;
  @Input() scrollableMempool: boolean = false;
  @Input() containerWidth: number;

  @Output() mempoolOffsetChange: EventEmitter<number> = new EventEmitter();

  network: string;
  timeLtrSubscription: Subscription;
  timeLtr: boolean = this.stateService.timeLtr.value;
  ltrTransitionEnabled = false;
  flipping = false;
  connectionStateSubscription: Subscription;
  loadingTip: boolean = true;
  connected: boolean = true;
  blockDisplayMode: 'size' | 'fees';

  dividerOffset: number | null = null;
  mempoolOffset: number | null = null;
  positionStyle = {
    transform: "translateX(1280px)",
  };
  blockDisplayToggleStyle = {};

  constructor(
    public stateService: StateService,
    public StorageService: StorageService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.onResize();
    this.network = this.stateService.network;
    this.timeLtrSubscription = this.stateService.timeLtr.subscribe((ltr) => {
      this.timeLtr = !!ltr;
      this.updateStyle();
    });
    this.connectionStateSubscription = this.stateService.connectionState$.subscribe(state => {
      this.connected = (state === 2);
    });
    firstValueFrom(this.stateService.chainTip$).then(() => {
      this.loadingTip = false;
    });
    this.blockDisplayMode = this.StorageService.getValue('block-display-mode-preference') as 'size' | 'fees' || 'fees';
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
    this.updateStyle();
    setTimeout(() => {
      this.ltrTransitionEnabled = true;
      this.flipping = true;
      this.stateService.timeLtr.next(!this.timeLtr);
      this.cd.markForCheck();
      setTimeout(() => {
        this.ltrTransitionEnabled = false;
        this.flipping = false;
        this.mempoolOffset = prevOffset;
        this.mempoolOffsetChange.emit((this.mempoolOffset || 0));
        this.updateStyle();
        this.cd.markForCheck();
      },  1000);
    }, 0);
  }

  toggleBlockDisplayMode(): void {
    if (this.blockDisplayMode === 'size') this.blockDisplayMode = 'fees';
    else this.blockDisplayMode = 'size';
    this.StorageService.setValue('block-display-mode-preference', this.blockDisplayMode);
    this.stateService.blockDisplayMode$.next(this.blockDisplayMode);
  }

  onMempoolWidthChange(width): void {
    if (this.flipping) {
      return;
    }
    this.mempoolOffset = Math.max(0, width - (this.dividerOffset || 0));
    this.updateStyle();
    this.mempoolOffsetChange.emit(this.mempoolOffset);
  }

  updateStyle(): void {
    if (this.dividerOffset == null || this.mempoolOffset == null) {
      return;
    }
    const oldTransform = this.positionStyle.transform;
    this.positionStyle = this.timeLtr ? {
      transform: `translateX(calc(100vw - ${this.dividerOffset + this.mempoolOffset}px)`,
    } : {
      transform: `translateX(${this.dividerOffset + this.mempoolOffset}px)`,
    };
    if (oldTransform !== this.positionStyle.transform) {
      this.cd.detectChanges();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.containerWidth) {
      this.onResize();
    }
  }

  onResize(): void {
    const width = this.containerWidth || window.innerWidth;
    if (width >= 768) {
      if (this.stateService.isLiquid()) {
        this.dividerOffset = 420;
      } else {
        this.dividerOffset = width * 0.5;
      }
    } else {
      if (this.stateService.isLiquid()) {
        this.dividerOffset = width * 0.5;
      } else {
        this.dividerOffset = width * 0.95;
      }
    }
    this.updateStyle();
  }
}
