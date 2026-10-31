import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { Status } from '@interfaces/electrs.interface';
import { feeLevels } from '@app/app.constants';
import { ThemeService } from '@app/services/theme.service';
import { fromEvent, Subscription } from 'rxjs';

export interface AddressBlockGroup {
  id: string;
  status: Status;
  count: number;
  net: number | null;
  received: boolean;
  sent: boolean;
  partial: boolean;
  skippedBlocks: number;
  feeRates: number[];
}

@Component({
  selector: 'app-address-blocks',
  templateUrl: './address-blocks.component.html',
  styleUrls: ['./address-blocks.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressBlocksComponent implements OnInit, OnChanges, OnDestroy {
  @Input() groups: AddressBlockGroup[] = [];
  @Input() selectedGroup: string | null = null;
  @Input() loading = false;
  @Input() fullyLoaded = false;
  @Output() selectGroup = new EventEmitter<string>();
  @Output() loadMore = new EventEmitter<void>();

  pendingBackground: string;
  dragging = false;
  @ViewChild('strip', { static: true }) strip: ElementRef<HTMLElement>;
  private subscriptions = new Subscription();
  private pointerId: number | null = null;
  private startX = 0;
  private startScrollLeft = 0;
  private suppressClick = false;

  constructor(private themeService: ThemeService, private cd: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.subscriptions.add(this.themeService.themeState$.subscribe(({ loading }) => {
      if (!loading) {
        this.updatePendingBackground();
        this.cd.markForCheck();
      }
    }));
    // Cancel the click before it reaches a block button or router link after dragging.
    this.subscriptions.add(fromEvent<MouseEvent>(this.strip.nativeElement, 'click', { capture: true }).subscribe(event => {
      if (this.suppressClick && event.detail > 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }));
  }

  ngOnChanges(): void {
    this.updatePendingBackground();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onPointerDown(event: PointerEvent): void {
    this.suppressClick = false;
    // Touch and trackpad scrolling remain native, including their momentum.
    if (event.pointerType !== 'mouse' || event.button !== 0) {
      return;
    }
    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startScrollLeft = this.strip.nativeElement.scrollLeft;
  }

  onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    if (!(event.buttons & 1)) {
      this.onPointerUp(event);
      return;
    }
    const distance = this.startX - event.clientX;
    if (!this.dragging && Math.abs(distance) < 5) {
      return;
    }
    if (!this.dragging) {
      this.dragging = true;
      this.suppressClick = true;
      this.strip.nativeElement.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    this.strip.nativeElement.scrollLeft = this.startScrollLeft + distance;
  }

  onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    this.pointerId = null;
    this.dragging = false;
    if (this.strip.nativeElement.hasPointerCapture(event.pointerId)) {
      this.strip.nativeElement.releasePointerCapture(event.pointerId);
    }
  }

  // BTC amounts must fit on one line of the block: use fewer decimals as the value grows,
  // and sats where BTC would round to zero or be too long even without decimals.
  forceSats(net: number): boolean {
    const btc = Math.abs(net) / 100_000_000;
    return net !== 0 && (btc < 0.0005 || btc >= 99_999.5);
  }

  btcDigits(net: number): string {
    const btc = Math.abs(net) / 100_000_000;
    if (btc < 99.9995) {
      return '1.2-3';
    }
    return btc < 999.995 ? '1.2-2' : '1.0-0';
  }

  private updatePendingBackground(): void {
    const fees = this.groups.find(group => !group.status.confirmed)?.feeRates ?? [];
    const colors = fees.slice().sort((a, b) => a - b).map(fee => {
      const nextLevel = feeLevels.findIndex(level => level > fee);
      const index = nextLevel < 0 ? feeLevels.length - 1 : Math.max(0, nextLevel - 1);
      return '#' + this.themeService.mempoolFeeColors[index];
    });
    this.pendingBackground = colors.length > 1
      ? `linear-gradient(to right, ${colors.join(', ')})`
      : colors[0] ?? 'var(--mempool-block-loading)';
  }
}
