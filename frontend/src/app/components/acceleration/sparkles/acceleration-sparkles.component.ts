import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';

@Component({
  selector: 'app-acceleration-sparkles',
  templateUrl: './acceleration-sparkles.component.html',
  styleUrls: ['./acceleration-sparkles.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccelerationSparklesComponent implements OnChanges {
  @Input() arrow: ElementRef<HTMLDivElement>;
  @Input() run: boolean = false;

  @ViewChild('sparkleAnchor')
  sparkleAnchor: ElementRef<HTMLDivElement>;

  constructor(
    private cd: ChangeDetectorRef,
  ) {}

  endTimeout: any;
  lastSparkle: number = 0;
  sparkleWidth: number = 0;
  sparkles: any[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.run) {
      if (this.endTimeout) {
        clearTimeout(this.endTimeout);
        this.endTimeout = null;
      }
      if (this.run) {
        this.doSparkle();
      } else {
        this.endTimeout = setTimeout(() => {
          this.sparkles = [];
        }, 2000);
      }
    }
  }

  doSparkle(): void {
    if (this.run) {
      const now = performance.now();
      if (now - this.lastSparkle > 20) {
        this.lastSparkle = now;
        if (this.arrow?.nativeElement && this.sparkleAnchor?.nativeElement) {
          const anchor = this.sparkleAnchor.nativeElement.getBoundingClientRect().right;
          const right = this.arrow.nativeElement.getBoundingClientRect().right;
          const dx = (anchor - right) + 30;
          const numSparkles = Math.ceil(Math.random() * 3);
          for (let i = 0; i < numSparkles; i++) {
            this.sparkles.push({
              style: {
                right: (dx + (Math.random() * 10)) + 'px',
                top: (15 + (Math.random() * 30)) + 'px',
              },
              rotation: {
                transform: `rotate(${Math.random() * 360}deg)`,
              }
            });
          }
          while (this.sparkles.length > 200) {
            this.sparkles.shift();
          }
          this.cd.markForCheck();
        }
      }
      requestAnimationFrame(() => {
        this.doSparkle();
      });
    }
  }
}