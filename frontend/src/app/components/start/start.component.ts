import { Component, ElementRef, HostListener, OnInit, OnDestroy, ViewChild, Input, DoCheck } from '@angular/core';
import { Subscription } from 'rxjs';
import { MarkBlockState, StateService } from '../../services/state.service';
import { specialBlocks } from '../../app.constants';
import { BlockExtended } from '../../interfaces/node-api.interface';

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.scss'],
})
export class StartComponent implements OnInit, OnDestroy, DoCheck {
  @Input() showLoadingIndicator = false;

  interval = 60;
  colors = ['#5E35B1', '#ffffff'];

  countdown = 0;
  specialEvent = false;
  eventName = '';
  mouseDragStartX: number;
  blockchainScrollLeftInit: number;
  timeLtrSubscription: Subscription;
  timeLtr: boolean = this.stateService.timeLtr.value;
  chainTipSubscription: Subscription;
  chainTip: number = -1;
  tipIsSet: boolean = false;
  lastMark: MarkBlockState;
  markBlockSubscription: Subscription;
  blockCounterSubscription: Subscription;
  @ViewChild('blockchainContainer') blockchainContainer: ElementRef;
  resetScrollSubscription: Subscription; 

  isMobile: boolean = false;
  isiOS: boolean = false;
  blockWidth = 155;
  dynamicBlocksAmount: number = 8;
  blockCount: number = 0;
  blocksPerPage: number = 1;
  pageWidth: number;
  firstPageWidth: number;
  minScrollWidth: number;
  pageIndex: number = 0;
  pages: any[] = [];
  pendingMark: number | null = null;
  pendingOffset: number | null = null;
  lastUpdate: number = 0;
  lastMouseX: number;
  velocity: number = 0;
  mempoolOffset: number = 0;

  constructor(
    private stateService: StateService,
  ) {
    this.isiOS = ['iPhone','iPod','iPad'].includes((navigator as any)?.userAgentData?.platform || navigator.platform);
  }

  ngDoCheck(): void {
    if (this.pendingOffset != null) {
      const offset = this.pendingOffset;
      this.pendingOffset = null;
      this.addConvertedScrollOffset(offset);
    }
  }

  ngOnInit() {
    this.firstPageWidth = 40 + (this.blockWidth * this.dynamicBlocksAmount);
    this.blockCounterSubscription = this.stateService.blocks$.subscribe((blocks) => {
      this.blockCount = blocks.length;
      this.dynamicBlocksAmount = Math.min(this.blockCount, this.stateService.env.KEEP_BLOCKS_AMOUNT, 8);
      this.firstPageWidth = 40 + (this.blockWidth * this.dynamicBlocksAmount);
      if (this.blockCount <= Math.min(8, this.stateService.env.KEEP_BLOCKS_AMOUNT)) {
        this.onResize();
      }
    });
    this.onResize();
    this.updatePages();
    this.timeLtrSubscription = this.stateService.timeLtr.subscribe((ltr) => {
      this.timeLtr = !!ltr;
    });
    this.chainTipSubscription = this.stateService.chainTip$.subscribe((height) => {
      this.chainTip = height;
      this.tipIsSet = true;
      this.updatePages();
      this.applyPendingMarkArrow();
    });
    this.markBlockSubscription = this.stateService.markBlock$.subscribe((mark) => {
      let blockHeight;
      let newMark = true;
      if (mark?.blockHeight != null) {
        if (this.lastMark?.blockHeight === mark.blockHeight) {
          newMark = false;
        }
        blockHeight = mark.blockHeight;
      } else if (mark?.mempoolBlockIndex != null) {
        if (this.lastMark?.mempoolBlockIndex === mark.mempoolBlockIndex || (mark.txid && this.lastMark?.txid === mark.txid)) {
          newMark = false;
        }
        blockHeight = -1 - mark.mempoolBlockIndex;
      } else if (mark?.mempoolPosition?.block != null) {
        if (this.lastMark?.txid === mark.txid) {
          newMark = false;
        }
        blockHeight = -1 - mark.mempoolPosition.block;
      }
      this.lastMark = mark;
      if (blockHeight != null) {
        if (this.tipIsSet) {
          let scrollToHeight = blockHeight;
          if (blockHeight < 0) {
            scrollToHeight = this.chainTip - blockHeight;
          }
          if (newMark && !this.blockInViewport(scrollToHeight)) {
            this.scrollToBlock(scrollToHeight);
          }
        }
        if (!this.tipIsSet || (blockHeight < 0 && !this.mempoolOffset)) {
          this.pendingMark = blockHeight;
        }
      }
    });
    this.stateService.blocks$
      .subscribe((blocks: BlockExtended[]) => {
        this.countdown = 0;
        const block = blocks[0];
        if (!block) {
          return;
        }

        for (const sb in specialBlocks) {
          if (specialBlocks[sb].networks.includes(this.stateService.network || 'mainnet')) {
            const height = parseInt(sb, 10);
            const diff = height - block.height;
            if (diff > 0 && diff <= 1008) {
              this.countdown = diff;
              this.eventName = specialBlocks[sb].labelEvent;
            }
          }
        }
        if (specialBlocks[block.height] && specialBlocks[block.height].networks.includes(this.stateService.network || 'mainnet')) {
          this.specialEvent = true;
          this.eventName = specialBlocks[block.height].labelEventCompleted;
          setTimeout(() => {
            this.specialEvent = false;
          }, 60 * 60 * 1000);
        }
      });
    this.resetScrollSubscription = this.stateService.resetScroll$.subscribe(reset => {
      if (reset) {
        this.resetScroll();
        this.stateService.resetScroll$.next(false);
      } 
    });
  }

  onMempoolOffsetChange(offset): void {
    const delta = offset - this.mempoolOffset;
    this.addConvertedScrollOffset(delta);
    this.mempoolOffset = offset;
    this.applyPendingMarkArrow();
  }

  applyPendingMarkArrow(): void {
    if (this.pendingMark != null) {
      if (this.pendingMark < 0) {
        this.scrollToBlock(this.chainTip - this.pendingMark);
      } else {
        this.scrollToBlock(this.pendingMark);
      }
      this.pendingMark = null;
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.isMobile = window.innerWidth <= 767.98;
    let firstVisibleBlock;
    let offset;
    if (this.blockchainContainer?.nativeElement != null) {
      this.pages.forEach(page => {
        const left = page.offset - this.getConvertedScrollOffset();
        const right = left + this.pageWidth;
        if (left <= 0 && right > 0) {
          const blockIndex = Math.max(0, Math.floor(left / -this.blockWidth));
          firstVisibleBlock = page.height - blockIndex;
          offset = left + (blockIndex * this.blockWidth);
        }
      });
    }

    this.blocksPerPage = Math.ceil(window.innerWidth / this.blockWidth);
    this.pageWidth = this.blocksPerPage * this.blockWidth;
    this.minScrollWidth = this.firstPageWidth + (this.pageWidth * 2);

    if (firstVisibleBlock != null) {
      this.scrollToBlock(firstVisibleBlock, offset + (this.isMobile ? this.blockWidth : 0));
    } else {
      this.updatePages();
    }
  }

  onMouseDown(event: MouseEvent) {
    if (!(event.which > 1 || event.button > 0)) {
      this.mouseDragStartX = event.clientX;
      this.resetMomentum(event.clientX);
      this.blockchainScrollLeftInit = this.blockchainContainer.nativeElement.scrollLeft;
    }
  }
  onPointerDown(event: PointerEvent) {
    if (this.isiOS) {
      event.preventDefault();
      this.onMouseDown(event);
    }
  }
  onDragStart(event: MouseEvent) { // Ignore Firefox annoying default drag behavior
    event.preventDefault();
  }
  onTouchMove(event: TouchEvent) {
    // disable native scrolling on iOS
    if (this.isiOS) {
      event.preventDefault();
    }
  }

  // We're catching the whole page event here because we still want to scroll blocks
  // even if the mouse leave the blockchain blocks container. Same idea for mouseup below.
  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.mouseDragStartX != null) {
      this.updateVelocity(event.clientX);
      this.stateService.setBlockScrollingInProgress(true);
      this.blockchainContainer.nativeElement.scrollLeft =
        this.blockchainScrollLeftInit + this.mouseDragStartX - event.clientX;
    }
  }
  @HostListener('document:mouseup', [])
  onMouseUp() {
    this.mouseDragStartX = null;
    this.animateMomentum();
  }
  @HostListener('document:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (this.isiOS) {
      this.onMouseMove(event);
    }
  }
  @HostListener('document:pointerup', [])
  @HostListener('document:pointercancel', [])
  onPointerUp() {
    if (this.isiOS) {
      this.onMouseUp();
    }
  }

  resetMomentum(x: number) {
    this.lastUpdate = performance.now();
    this.lastMouseX = x;
    this.velocity = 0;
  }

  updateVelocity(x: number) {
    const now = performance.now();
    let dt = now - this.lastUpdate;
    if (dt > 0) {
      this.lastUpdate = now;
      const velocity = (x - this.lastMouseX) / dt;
      this.velocity = (0.8 * this.velocity) + (0.2 * velocity);
      this.lastMouseX = x;
    }
  }

  animateMomentum() {
    this.lastUpdate = performance.now();
    requestAnimationFrame(() => {
      const now = performance.now();
      const dt = now - this.lastUpdate;
      this.lastUpdate = now;
      if (Math.abs(this.velocity) < 0.005) {
        this.stateService.setBlockScrollingInProgress(false);
      } else {
        const deceleration = Math.max(0.0025, 0.001 * this.velocity * this.velocity) * (this.velocity > 0 ? -1 : 1);
        const displacement = (this.velocity * dt) - (0.5 * (deceleration * dt * dt));
        const dv = (deceleration * dt);
        if ((this.velocity < 0 && dv + this.velocity > 0) || (this.velocity > 0 && dv + this.velocity < 0)) {
          this.velocity = 0;
        } else {
          this.velocity += dv;
        }
        this.blockchainContainer.nativeElement.scrollLeft -= displacement;
        this.animateMomentum();
      }
    });
  }

  onScroll(e) {
    const middlePage = this.pageIndex === 0 ? this.pages[0] : this.pages[1];
    // compensate for css transform
    const translation = (this.isMobile ? window.innerWidth * 0.95 : window.innerWidth * 0.5);
    const backThreshold = middlePage.offset + (this.pageWidth * 0.5) + translation;
    const forwardThreshold = middlePage.offset - (this.pageWidth * 0.5) + translation;
    const scrollLeft = this.getConvertedScrollOffset();
    if (scrollLeft > backThreshold) {
      if (this.shiftPagesBack()) {
        this.addConvertedScrollOffset(-this.pageWidth);
        this.blockchainScrollLeftInit -= this.pageWidth;
      }
    } else if (scrollLeft < forwardThreshold) {
      if (this.shiftPagesForward()) {
        this.addConvertedScrollOffset(this.pageWidth);
        this.blockchainScrollLeftInit += this.pageWidth;
      }
    }
  }

  scrollToBlock(height, blockOffset = 0) {
    if (!this.blockchainContainer?.nativeElement) {
      setTimeout(() => { this.scrollToBlock(height, blockOffset); }, 50);
      return;
    }
    if (this.isMobile) {
      blockOffset -= this.blockWidth;
    }
    const viewingPageIndex = this.getPageIndexOf(height);
    const pages = [];
    this.pageIndex = Math.max(viewingPageIndex - 1, 0);
    let viewingPage = this.getPageAt(viewingPageIndex);
    const isLastPage = viewingPage.height < this.blocksPerPage;
    if (isLastPage) {
      this.pageIndex = Math.max(viewingPageIndex - 2, 0);
      viewingPage = this.getPageAt(viewingPageIndex);
    }
    const left = viewingPage.offset - this.getConvertedScrollOffset();
    const blockIndex = viewingPage.height - height;
    const targetOffset = (this.blockWidth * blockIndex) + left;
    let deltaOffset = targetOffset - blockOffset;

    if (isLastPage) {
      pages.push(this.getPageAt(viewingPageIndex - 2));
    }
    if (viewingPageIndex > 1) {
      pages.push(this.getPageAt(viewingPageIndex - 1));
    }
    if (viewingPageIndex > 0) {
      pages.push(viewingPage);
    }
    if (!isLastPage) {
      pages.push(this.getPageAt(viewingPageIndex + 1));
    }
    if (viewingPageIndex === 0) {
      pages.push(this.getPageAt(viewingPageIndex + 2));
    }

    this.pages = pages;
    this.addConvertedScrollOffset(deltaOffset);
  }

  updatePages() {
    const pages = [];
    if (this.pageIndex > 0) {
      pages.push(this.getPageAt(this.pageIndex));
    }
    pages.push(this.getPageAt(this.pageIndex + 1));
    pages.push(this.getPageAt(this.pageIndex + 2));
    this.pages = pages;
  }

  shiftPagesBack(): boolean {
    const nextPage = this.getPageAt(this.pageIndex + 3);
    if (nextPage.height >= 0) {
      this.pageIndex++;
      this.pages.forEach(page => page.offset -= this.pageWidth);
      if (this.pageIndex !== 1) {
        this.pages.shift();
      }
      this.pages.push(this.getPageAt(this.pageIndex + 2));
     return true;
    } else {
      return false;
    }
  }

  shiftPagesForward(): boolean {
    if (this.pageIndex > 0) {
      this.pageIndex--;
      this.pages.forEach(page => page.offset += this.pageWidth);
      this.pages.pop();
      if (this.pageIndex) {
        this.pages.unshift(this.getPageAt(this.pageIndex));
      }
      return true;
    }
    return false;
  }

  getPageAt(index: number) {
    const height = this.chainTip - this.dynamicBlocksAmount - ((index - 1) * this.blocksPerPage);
    return {
      offset: this.firstPageWidth + (this.pageWidth * (index - 1 - this.pageIndex)),
      height: height,
      depth: this.chainTip - height,
      index: index,
    };
  }

  resetScroll(): void {
    this.scrollToBlock(this.chainTip);
    this.setScrollLeft(0);
  }

  getPageIndexOf(height: number): number {
    const delta = this.chainTip - this.dynamicBlocksAmount - height;
    return Math.max(0, Math.floor(delta / this.blocksPerPage) + 1);
  }

  blockInViewport(height: number): boolean {
    const firstHeight = this.pages[0].height;
    const translation = (this.isMobile ? window.innerWidth * 0.95 : window.innerWidth * 0.5);
    const firstX = this.pages[0].offset - this.getConvertedScrollOffset() + translation;
    const xPos = firstX + ((firstHeight - height) * 155);
    return xPos > -55 && xPos < (window.innerWidth - 100);
  }

  getConvertedScrollOffset(): number {
    if (this.timeLtr) {
      return -(this.blockchainContainer?.nativeElement?.scrollLeft || 0) - this.mempoolOffset;
    } else {
      return (this.blockchainContainer?.nativeElement?.scrollLeft || 0) - this.mempoolOffset;
    }
  }

  setScrollLeft(offset: number): void {
    if (this.timeLtr) {
      this.blockchainContainer.nativeElement.scrollLeft = offset - this.mempoolOffset;
    } else {
      this.blockchainContainer.nativeElement.scrollLeft = offset + this.mempoolOffset;
    }
  }

  addConvertedScrollOffset(offset: number): void {
    if (!this.blockchainContainer?.nativeElement) {
      this.pendingOffset = offset;
      return;
    }
    if (this.timeLtr) {
      this.blockchainContainer.nativeElement.scrollLeft -= offset;
    } else {
      this.blockchainContainer.nativeElement.scrollLeft += offset;
    }
  }

  ngOnDestroy() {
    if (this.blockchainContainer?.nativeElement) {
      // clean up scroll position to prevent caching wrong scroll in Firefox
      this.setScrollLeft(0);
    }
    this.timeLtrSubscription.unsubscribe();
    this.chainTipSubscription.unsubscribe();
    this.markBlockSubscription.unsubscribe();
    this.blockCounterSubscription.unsubscribe();
    this.resetScrollSubscription.unsubscribe();
  }
}
