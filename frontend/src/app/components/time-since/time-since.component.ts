import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, Input, ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-time-since',
  template: `{{ time | timeSince : trigger }}`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeSinceComponent implements OnInit, OnDestroy {
  interval: number;
  trigger = 0;

  @Input() time: number;
  @Input() fastRender = false;

  constructor(
    private ref: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.interval = window.setInterval(() => {
      this.trigger++;
      this.ref.markForCheck();
    }, 1000 * (this.fastRender ? 1 : 60));
  }

  ngOnDestroy() {
    clearInterval(this.interval);
  }

}
