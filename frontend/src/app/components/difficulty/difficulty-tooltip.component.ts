import { Component, ElementRef, ViewChild, Input, OnChanges, HostListener } from '@angular/core';

interface EpochProgress {
  base: string;
  change: number;
  progress: number;
  minedBlocks: number;
  remainingBlocks: number;
  expectedBlocks: number;
  newDifficultyHeight: number;
  colorAdjustments: string;
  colorPreviousAdjustments: string;
  estimatedRetargetDate: number;
  previousRetarget: number;
  blocksUntilHalving: number;
  timeUntilHalving: number;
}

const EPOCH_BLOCK_LENGTH = 2016; // Bitcoin mainnet

@Component({
  selector: 'app-difficulty-tooltip',
  templateUrl: './difficulty-tooltip.component.html',
  styleUrls: ['./difficulty-tooltip.component.scss'],
  standalone: false,
})
export class DifficultyTooltipComponent implements OnChanges {
  @Input() status: string | void;
  @Input() progress: EpochProgress | void = null; 
  @Input() cursorPosition: { x: number, y: number };

  mined: number;
  ahead: number;
  behind: number;
  expected: number;
  remaining: number;
  isAhead: boolean;
  isBehind: boolean;
  isMobile: boolean;

  tooltipPosition = { x: 0, y: 0 };

  @ViewChild('tooltip') tooltipElement: ElementRef<HTMLCanvasElement>;

  constructor() {
    this.onResize();
  }

  ngOnChanges(changes): void {
    if (changes.cursorPosition && changes.cursorPosition.currentValue) {
      let x = changes.cursorPosition.currentValue.x;
      let y = changes.cursorPosition.currentValue.y - 50;
      if (this.tooltipElement) {
        const elementBounds = this.tooltipElement.nativeElement.getBoundingClientRect();
        x -= elementBounds.width / 2;
        x = Math.min(Math.max(x, 20), (window.innerWidth - 20 - elementBounds.width));
      }
      this.tooltipPosition = { x, y };
    }
    if ((changes.progress || changes.status) && this.progress && this.status) {
      this.remaining = this.progress.remainingBlocks;
      this.expected = this.progress.expectedBlocks;
      this.mined = this.progress.minedBlocks;
      this.ahead = Math.max(0, this.mined - this.expected);
      this.behind = Math.max(0, this.expected - this.mined);
      this.isAhead = this.ahead > 0;
      this.isBehind = this.behind > 0;
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile = window.innerWidth <= 767.98;
  }
}
