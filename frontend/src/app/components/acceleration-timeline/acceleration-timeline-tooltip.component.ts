import { Component, ElementRef, ViewChild, Input, OnChanges } from '@angular/core';

@Component({
  selector: 'app-acceleration-timeline-tooltip',
  templateUrl: './acceleration-timeline-tooltip.component.html',
  styleUrls: ['./acceleration-timeline-tooltip.component.scss'],
})
export class AccelerationTimelineTooltipComponent implements OnChanges {
  @Input() accelerationInfo: any;
  @Input() cursorPosition: { x: number, y: number };

  tooltipPosition: any = null;

  @ViewChild('tooltip') tooltipElement: ElementRef<HTMLCanvasElement>;

  constructor() {}

  ngOnChanges(changes): void {
    if (changes.cursorPosition && changes.cursorPosition.currentValue) {
      let x = Math.max(10, changes.cursorPosition.currentValue.x - 50);
      let y = changes.cursorPosition.currentValue.y + 20;
      if (this.tooltipElement) {
        const elementBounds = this.tooltipElement.nativeElement.getBoundingClientRect();
        if ((x + elementBounds.width) > (window.innerWidth - 10)) {
          x = Math.max(0, window.innerWidth - elementBounds.width - 10);
        }
        if (y + elementBounds.height > (window.innerHeight - 20)) {
          y = y - elementBounds.height - 20;
        }
      }
      this.tooltipPosition = { x, y };
    }
  }

  hasPoolsData(): boolean {
    return Object.keys(this.accelerationInfo.poolsData).length > 0;
  }
}
