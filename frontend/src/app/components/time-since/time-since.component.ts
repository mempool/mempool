import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, Input, ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-time-since',
  template: `{{ text }}`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeSinceComponent implements OnInit, OnDestroy {
  interval: number;
  text: string;

  @Input() time: number;
  @Input() fastRender = false;

  constructor(
    private ref: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.text = this.calculate();
    this.interval = window.setInterval(() => {
      this.text = this.calculate();
      this.ref.markForCheck();
    }, 1000 * (this.fastRender ? 1 : 60));
  }

  ngOnDestroy() {
    clearInterval(this.interval);
  }

  calculate() {
    const seconds = Math.floor((+new Date() - +new Date(this.time * 1000)) / 1000);
    if (seconds < 60) {
      return '< 1 minute';
    }
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60,
        second: 1
    };
    let counter;
    for (const i in intervals) {
      if (intervals.hasOwnProperty(i)) {
        counter = Math.floor(seconds / intervals[i]);
        if (counter > 0) {
          if (counter === 1) {
              return counter + ' ' + i; // singular (1 day ago)
          } else {
              return counter + ' ' + i + 's'; // plural (2 days ago)
          }
        }
      }
    }
  }

}
