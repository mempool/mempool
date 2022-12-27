import { Component, ElementRef, HostListener, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { StateService } from '../../services/state.service';
import { specialBlocks } from '../../app.constants';

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.scss'],
})
export class StartComponent implements OnInit, OnDestroy {
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
  markBlockSubscription: Subscription;
  @ViewChild('blockchainContainer') blockchainContainer: ElementRef;

  isMobile: boolean = false;
  blockWidth = 155;
  blocksPerPage: number = 1;
  pageWidth: number;
  firstPageWidth: number;
  pageIndex: number = 0;
  pages: any[] = [];

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.firstPageWidth = 40 + (this.blockWidth * this.stateService.env.KEEP_BLOCKS_AMOUNT);
    this.onResize();
    this.timeLtrSubscription = this.stateService.timeLtr.subscribe((ltr) => {
      this.timeLtr = !!ltr;
    });
    this.chainTipSubscription = this.stateService.chainTip$.subscribe((height) => {
      this.chainTip = height;
      this.updatePages();
    });
    this.stateService.blocks$
      .subscribe((blocks: any) => {
        if (this.stateService.network !== '') {
          return;
        }
        this.countdown = 0;
        const block = blocks[0];

        for (const sb in specialBlocks) {
          const height = parseInt(sb, 10);
          const diff = height - block.height;
          if (diff > 0 && diff <= 1008) {
            this.countdown = diff;
            this.eventName = specialBlocks[sb].labelEvent;
          }
        }
        if (specialBlocks[block.height]) {
          this.specialEvent = true;
          this.eventName = specialBlocks[block.height].labelEventCompleted;
          setTimeout(() => {
            this.specialEvent = false;
          }, 60 * 60 * 1000);
        }
      });
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.isMobile = window.innerWidth <= 767.98;
    let firstVisibleBlock;
    let offset;
    this.pages.forEach(page => {
      const left = page.offset - (this.blockchainContainer?.nativeElement?.scrollLeft || 0);
      const right = left + this.pageWidth;
      if (left <= 0 && right > 0) {
        const blockIndex = Math.max(0, Math.floor(left / -this.blockWidth));
        firstVisibleBlock = page.height - blockIndex;
        offset = left + (blockIndex * this.blockWidth);
      }
    });

    this.blocksPerPage = Math.ceil(window.innerWidth / this.blockWidth);
    this.pageWidth = this.blocksPerPage * this.blockWidth;

    if (firstVisibleBlock != null) {
      this.scrollToBlock(firstVisibleBlock, offset);
    } else {
      this.updatePages();
    }
  }

  onMouseDown(event: MouseEvent) {
    this.mouseDragStartX = event.clientX;
    this.blockchainScrollLeftInit = this.blockchainContainer.nativeElement.scrollLeft;
  }
  onDragStart(event: MouseEvent) { // Ignore Firefox annoying default drag behavior
    event.preventDefault();
  }

  // We're catching the whole page event here because we still want to scroll blocks
  // even if the mouse leave the blockchain blocks container. Same idea for mouseup below.
  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.mouseDragStartX != null) {
      this.stateService.setBlockScrollingInProgress(true);
      this.blockchainContainer.nativeElement.scrollLeft =
        this.blockchainScrollLeftInit + this.mouseDragStartX - event.clientX;
    }
  }
  @HostListener('document:mouseup', [])
  onMouseUp() {
    this.mouseDragStartX = null;
    this.stateService.setBlockScrollingInProgress(false);
  }

  onScroll(e) {
    const middlePage = this.pageIndex === 0 ? this.pages[0] : this.pages[1];
    // compensate for css transform
    const translation = (this.isMobile ? window.innerWidth * 0.95 : window.innerWidth * 0.5);
    const backThreshold = middlePage.offset + (this.pageWidth * 0.5) + translation;
    const forwardThreshold = middlePage.offset - (this.pageWidth * 0.5) + translation;
    if (this.timeLtr) {
      if (e.target.scrollLeft < -backThreshold) {
        if (this.shiftPagesBack()) {
          e.target.scrollLeft += this.pageWidth;
        }
      } else if (e.target.scrollLeft > -forwardThreshold) {
        if (this.shiftPagesForward()) {
          e.target.scrollLeft -= this.pageWidth;
        }
      }
    } else {
      if (e.target.scrollLeft > backThreshold) {
        if (this.shiftPagesBack()) {
          e.target.scrollLeft -= this.pageWidth;
        }
      } else if (e.target.scrollLeft < forwardThreshold) {
        if (this.shiftPagesForward()) {
          e.target.scrollLeft += this.pageWidth;
        }
      }
    }
  }

  scrollToBlock(height, blockOffset = 0) {
    if (!this.blockchainContainer?.nativeElement) {
      setTimeout(() => { this.scrollToBlock(height, blockOffset); }, 50);
      return;
    }
    let targetHeight = this.isMobile ? height - 1 : height;
    const middlePageIndex = this.getPageIndexOf(targetHeight);
    const pages = [];
    if (middlePageIndex > 0) {
      this.pageIndex = middlePageIndex - 1;
      const middlePage = this.getPageAt(middlePageIndex);
      const left = middlePage.offset - this.blockchainContainer.nativeElement.scrollLeft;
      const blockIndex = middlePage.height - targetHeight;
      const targetOffset = (this.blockWidth * blockIndex) + left;
      const deltaOffset = targetOffset - blockOffset;
      if (this.pageIndex > 0) {
        pages.push(this.getPageAt(this.pageIndex));
      }
      pages.push(middlePage);
      pages.push(this.getPageAt(middlePageIndex + 1));
      this.pages = pages;
      this.blockchainContainer.nativeElement.scrollLeft += deltaOffset;
    } else {
      this.pageIndex = 0;
      this.updatePages();
    }
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
    this.pageIndex++;
    this.pages.forEach(page => page.offset -= this.pageWidth);
    if (this.pageIndex !== 1) {
      this.pages.shift();
    }
    this.pages.push(this.getPageAt(this.pageIndex + 2));
    return true;
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
    return {
      offset: this.firstPageWidth + (this.pageWidth * (index - 1 - this.pageIndex)),
      height: this.chainTip - 8 - ((index - 1) * this.blocksPerPage),
    };
  }

  getPageIndexOf(height: number): number {
    const delta = this.chainTip - 8 - height;
    return Math.max(0, Math.floor(delta / this.blocksPerPage) + 1);
  }

  ngOnDestroy() {
    this.timeLtrSubscription.unsubscribe();
  }
}
