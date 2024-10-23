import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, Input, OnChanges, ChangeDetectorRef } from '@angular/core';
import { firstValueFrom, Subscription } from 'rxjs';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-clockchain',
  templateUrl: './clockchain.component.html',
  styleUrls: ['./clockchain.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClockchainComponent implements OnInit, OnChanges, OnDestroy {
  @Input() width: number = 300;
  @Input() height: number = 60;
  @Input() mode: 'mempool' | 'mined' | 'none';
  @Input() index: number = 0;

  mempoolBlocks: number = 3;
  blockchainBlocks: number = 6;
  blockWidth: number = 50;
  dividerStyle;

  network: string;
  timeLtrSubscription: Subscription;
  timeLtr: boolean = this.stateService.timeLtr.value;
  ltrTransitionEnabled = false;
  connectionStateSubscription: Subscription;
  loadingTip: boolean = true;
  connected: boolean = true;

  constructor(
    public stateService: StateService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.ngOnChanges();

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

  ngOnChanges() {
    this.blockWidth = Math.floor(7 * this.height / 12);
    this.mempoolBlocks = Math.floor(((this.width / 2) - (this.blockWidth * 0.32)) / (1.24 * this.blockWidth));
    this.blockchainBlocks = this.mempoolBlocks;
    this.dividerStyle = {
      width: '2px',
      height: `${this.height}px`,
    };
    this.cd.markForCheck();
  }

  ngOnDestroy() {
    this.timeLtrSubscription.unsubscribe();
    this.connectionStateSubscription.unsubscribe();
  }

  trackByPageFn(index: number, item: { index: number }) {
    return item.index;
  }

  toggleTimeDirection() {
    this.ltrTransitionEnabled = true;
    this.stateService.timeLtr.next(!this.timeLtr);
  }

  getMempoolUrl(index): string {
    return `/clock/mempool/${index}`;
  }

  getMinedUrl(index): string {
    return `/clock/block/${index}`;
  }
}
