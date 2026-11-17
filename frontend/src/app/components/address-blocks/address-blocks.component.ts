import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostBinding, Input, NgZone, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { AddressBlockGroup, minedBlockBackground, pendingBlockBackground } from '@components/address-blocks/address-blocks.utils';
import { ThemeService } from '@app/services/theme.service';
import { StateService } from '@app/services/state.service';
import { fromEvent, Subscription } from 'rxjs';

const MAX_AUTO_LOADS = 2;

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
  @Output() loadMore = new EventEmitter<boolean>();

  @HostBinding('style.--sticky-top') stickyTop = '0px';
  pendingBackground: string;
  blockBackground: string;
  dragging = false;
  @ViewChild('strip', { static: true }) strip: ElementRef<HTMLElement>;
  private subscriptions = new Subscription();
  private pointerId: number | null = null;
  private startX = 0;
  private startScrollLeft = 0;
  private suppressClick = false;
  private headerObserver: ResizeObserver;
  private autoLoads = 0;

  constructor(
    private themeService: ThemeService,
    private stateService: StateService,
    private cd: ChangeDetectorRef,
    private zone: NgZone,
  ) {}

  ngOnInit(): void {
    // Stick below the site header, whose height changes with the screen size.
    const header = document.querySelector<HTMLElement>('header.sticky-header');
    if (header) {
      this.headerObserver = new ResizeObserver(() => {
        this.stickyTop = `${header.offsetHeight}px`;
        this.cd.markForCheck();
      });
      this.headerObserver.observe(header);
    }
    // networkChanged$ only emits on changes, so start from the current network.
    this.blockBackground = minedBlockBackground(this.stateService.network);
    this.subscriptions.add(this.stateService.networkChanged$.subscribe(network => {
      this.blockBackground = minedBlockBackground(network);
      this.cd.markForCheck();
    }));
    this.subscriptions.add(this.themeService.themeState$.subscribe(({ loading }) => {
      if (!loading) {
        this.updatePendingBackground();
        this.cd.markForCheck();
      }
    }));
    // Load older activity when the strip is scrolled close to its end, like the transaction list does.
    this.zone.runOutsideAngular(() => {
      this.subscriptions.add(fromEvent(this.strip.nativeElement, 'scroll', { passive: true }).subscribe(() => {
        const strip = this.strip.nativeElement;
        const remaining = strip.scrollWidth - strip.scrollLeft - strip.clientWidth;
        if (!this.loading && !this.fullyLoaded && remaining < 2 * strip.querySelector<HTMLElement>('.activity-block').offsetWidth) {
          this.zone.run(() => this.loadMore.emit(false));
        }
      }));
    });
    // Cancel the click before it reaches a block button or router link after dragging.
    this.subscriptions.add(fromEvent<MouseEvent>(this.strip.nativeElement, 'click', { capture: true }).subscribe(event => {
      if (this.suppressClick && event.detail > 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }));
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.updatePendingBackground();
    if (changes.groups && !this.groups.length) {
      this.autoLoads = 0;
    }
    if (changes.groups || changes.loading || changes.fullyLoaded) {
      // Wait for the view to render the blocks before measuring the strip.
      requestAnimationFrame(() => this.loadMoreIfShort());
    }
    if (changes.selectedGroup && !changes.selectedGroup.firstChange) {
      // Wait for the view to render the selection before revealing it.
      requestAnimationFrame(() => this.revealSelectedBlock());
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.headerObserver?.disconnect();
  }

  private loadMoreIfShort(): void {
    const strip = this.strip.nativeElement;
    if (!this.loading && !this.fullyLoaded && this.groups.length && this.autoLoads < MAX_AUTO_LOADS
      && strip.scrollWidth <= strip.clientWidth) {
      this.autoLoads++;
      this.loadMore.emit(true);
    }
  }

  // Scrolls the strip, not the page, so the selected block is fully visible.
  private revealSelectedBlock(): void {
    const strip = this.strip.nativeElement;
    const block = [...strip.querySelectorAll<HTMLElement>('.activity-block')]
      .find(element => element.dataset.blockGroup === this.selectedGroup);
    if (!block || this.dragging) {
      return;
    }
    // The strip is the offset parent, so offsetLeft is the block's position within it.
    const left = block.offsetLeft;
    const right = left + block.offsetWidth;
    if (left < strip.scrollLeft) {
      strip.scrollTo({ left, behavior: 'smooth' });
    } else if (right > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: right - strip.clientWidth, behavior: 'smooth' });
    }
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
    this.pendingBackground = pendingBlockBackground(fees, this.themeService.mempoolFeeColors);
  }
}
