import { Component, ElementRef, ViewChild, Input, OnChanges } from '@angular/core';
import { RbfTree } from '@interfaces/node-api.interface';

@Component({
  selector: 'app-rbf-timeline-tooltip',
  templateUrl: './rbf-timeline-tooltip.component.html',
  styleUrls: ['./rbf-timeline-tooltip.component.scss'],
})
export class RbfTimelineTooltipComponent implements OnChanges {
  @Input() rbfInfo: RbfTree | null;
  @Input() cursorPosition: { x: number, y: number };

  tooltipPosition = null;

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
}
