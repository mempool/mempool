import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  NgZone,
  OnDestroy,
  Output,
  PLATFORM_ID,
} from '@angular/core';

@Directive({
  selector: '[infiniteScroll]',
  standalone: false,
})
export class InfiniteScrollDirective implements AfterViewInit, OnDestroy {
  @Input() infiniteScrollDistance = 2;
  @Input() infiniteScrollUpDistance = 1.5;
  @Input() infiniteScrollThrottle = 150;
  @Input() alwaysCallback = false;
  @Output() scrolled = new EventEmitter<void>();

  private lastCheck = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private triggeredTotal = 0;
  private readonly onScroll = (): void => this.scheduleCheck();

  constructor(
    private host: ElementRef<HTMLElement>,
    private zone: NgZone,
    @Inject(PLATFORM_ID) private platformId: object,
  ) { }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    });
  }

  ngOnDestroy(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('scroll', this.onScroll);
    }
  }

  private scheduleCheck(): void {
    const throttle = this.infiniteScrollThrottle || 0;
    const wait = throttle - (Date.now() - this.lastCheck);
    if (wait > 0) {
      if (this.retryTimer === null) {
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          this.lastCheck = Date.now();
          this.check();
        }, wait);
      }
      return;
    }
    this.lastCheck = Date.now();
    this.check();
  }

  // ngx-infinite-scroll window mode: fire when remaining / totalToScroll <= distance/10.
  // Scroll-event only — no init emit, matching production first-load.
  private check(): void {
    const host = this.host.nativeElement;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const top = host.getBoundingClientRect().top + scrollY;
    const totalToScroll = top + host.offsetHeight;
    if (totalToScroll <= 0) {
      return;
    }

    const scrolledUntilNow = viewportHeight + scrollY;
    const remaining = (totalToScroll - scrolledUntilNow) / totalToScroll;
    if (remaining > this.infiniteScrollDistance / 10) {
      return;
    }
    if (!this.alwaysCallback && this.triggeredTotal === totalToScroll) {
      return;
    }

    this.triggeredTotal = totalToScroll;
    this.zone.run(() => this.scrolled.emit());
  }
}
