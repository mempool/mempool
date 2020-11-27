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
      return '< 1 '+$localize`:@@time.minute:`;
    }
    let counter, unit;
    for (const i in this.intervals) {
      if (this.intervals.hasOwnProperty(i)) {
        counter = Math.floor(seconds / this.intervals[i]);
        if (counter > 0) {
          if (counter === 1) {
            switch (i) { // singular (1 day ago)
              case 'year': unit = $localize`:@@time.year:`; break;
              case 'month': unit = $localize`:@@time.month:`; break;
              case 'week': unit = $localize`:@@time.week:`; break;
              case 'day': unit = $localize`:@@time.day:`; break;
              case 'hour': unit = $localize`:@@time.hour:`; break;
              case 'minute':
		unit = $localize`:@@time.minute:`;
                if (document.body.clientWidth < 768)
		  unit = $localize`:@@time.min:`;
	        break;
              case 'second':
		unit = $localize`:@@time.second:`;
                if (document.body.clientWidth < 768)
		  unit = $localize`:@@time.sec:`;
	        break;
            }
            return counter + ' ' + unit;
          } else {
            switch (i) { // plural (2 days ago)
              case 'year': unit = $localize`:@@time.years:`; break;
              case 'month': unit = $localize`:@@time.months:`; break;
              case 'week': unit = $localize`:@@time.weeks:`; break;
              case 'day': unit = $localize`:@@time.days:`; break;
              case 'hour': unit = $localize`:@@time.hours:`; break;
              case 'minute':
		unit = $localize`:@@time.minutes:`;
                if (document.body.clientWidth < 768)
		  unit = $localize`:@@time.mins:`;
	        break;
              case 'second':
		unit = $localize`:@@time.seconds:`;
                if (document.body.clientWidth < 768)
		  unit = $localize`:@@time.secs:`;
	        break;
            }
            return counter + ' ' + unit;
          }
        }
      }
    }
  }

}
