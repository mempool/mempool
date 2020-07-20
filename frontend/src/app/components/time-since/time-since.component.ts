import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, Input, ChangeDetectorRef, OnChanges } from '@angular/core';

@Component({
  selector: 'app-time-since',
  template: `{{ text }}`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeSinceComponent implements OnInit, OnChanges, OnDestroy {
  interval: number;
  text: string;
  intervals = {};

  @Input() time: number;
  @Input() fastRender = false;

  constructor(
    private ref: ChangeDetectorRef
  ) {
    if (document.body.clientWidth < 768) {
      this.intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        min: 60,
        sec: 1
      };
    } else {
      this.intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60,
        second: 1
      };
    }
  }

  ngOnInit() {
    this.interval = window.setInterval(() => {
      this.text = this.calculate();
      this.ref.markForCheck();
    }, 1000 * (this.fastRender ? 1 : 60));
  }

  ngOnChanges() {
    this.text = this.calculate();
    this.ref.markForCheck();
  }

  ngOnDestroy() {
    clearInterval(this.interval);
  }

  calculate() {
    const seconds = Math.floor((+new Date() - +new Date(this.time * 1000)) / 1000);
    if (seconds < 60) {
      return '< 1 minute';
    }
    let counter;
    for (const i in this.intervals) {
      if (this.intervals.hasOwnProperty(i)) {
        counter = Math.floor(seconds / this.intervals[i]);
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
