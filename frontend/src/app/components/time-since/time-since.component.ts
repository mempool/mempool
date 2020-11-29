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
      return '< 1 '+$localize`:@@time-since.minute.ago:minute ago`;
    }
    let counter, unit;
    for (const i in this.intervals) {
      if (this.intervals.hasOwnProperty(i)) {
        counter = Math.floor(seconds / this.intervals[i]);
        if (counter > 0) {
          if (counter === 1) {
            switch (i) { // singular (1 day ago)
              case 'year': unit = $localize`:@@time-since.year.ago:year ago`; break;
              case 'month': unit = $localize`:@@time-since.month.ago:month ago`; break;
              case 'week': unit = $localize`:@@time-since.week.ago:week ago`; break;
              case 'day': unit = $localize`:@@time-since.day.ago:day ago`; break;
              case 'hour': unit = $localize`:@@time-since.hour.ago:hour ago`; break;
              case 'minute':
		unit = $localize`:@@time-since.minute.ago:minute ago`;
                if (document.body.clientWidth < 768)
		  unit = $localize`:@@time-since.min.ago:min ago`;
	        break;
              case 'second':
		unit = $localize`:@@time-since.second.ago:second ago`;
                if (document.body.clientWidth < 768)
		  unit = $localize`:@@time-since.sec.ago:sec ago`;
	        break;
            }
            return counter + ' ' + unit;
          } else {
            switch (i) { // plural (2 days ago)
              case 'year': unit = $localize`:@@time-since.years.ago:years ago`; break;
              case 'month': unit = $localize`:@@time-since.months.ago:months ago`; break;
              case 'week': unit = $localize`:@@time-since.weeks.ago:weeks ago`; break;
              case 'day': unit = $localize`:@@time-since.days.ago:days ago`; break;
              case 'hour': unit = $localize`:@@time-since.hours.ago:hours ago`; break;
              case 'minute':
		unit = $localize`:@@time-since.minutes.ago:minutes ago`;
                if (document.body.clientWidth < 768)
		  unit = $localize`:@@time-since.mins.ago:mins ago`;
	        break;
              case 'second':
		unit = $localize`:@@time-since.seconds.ago:seconds ago`;
                if (document.body.clientWidth < 768)
		  unit = $localize`:@@time-since.secs.ago:secs ago`;
	        break;
            }
            return counter + ' ' + unit;
          }
        }
      }
    }
  }

}
