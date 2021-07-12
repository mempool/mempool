import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  Input,
  ChangeDetectorRef,
  OnChanges,
  PLATFORM_ID,
  Inject,
} from '@angular/core';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-time-since',
  template: `{{ text }}`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeSinceComponent implements OnInit, OnChanges, OnDestroy {
  interval: number;
  text: string;
  intervals = {};

  @Input() time: number;
  @Input() fastRender = false;

  constructor(private ref: ChangeDetectorRef, private stateService: StateService) {
    this.intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
      second: 1,
    };
  }

  ngOnInit() {
    if (!this.stateService.isBrowser) {
      this.text = this.calculate();
      this.ref.markForCheck();
      return;
    }
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
      return $localize`:@@time-since.just-now:Just now`;
    }
    let counter;
    for (const i in this.intervals) {
      if (this.intervals.hasOwnProperty(i)) {
        counter = Math.floor(seconds / this.intervals[i]);
        if (counter > 0) {
          if (counter === 1) {
            switch (
              i // singular (1 day ago)
            ) {
              case 'year':
                return $localize`:@@time-since.year.ago:${counter}:INTERPOLATION: year ago`;
                break;
              case 'month':
                return $localize`:@@time-since.month.ago:${counter}:INTERPOLATION: month ago`;
                break;
              case 'week':
                return $localize`:@@time-since.week.ago:${counter}:INTERPOLATION: week ago`;
                break;
              case 'day':
                return $localize`:@@time-since.day.ago:${counter}:INTERPOLATION: day ago`;
                break;
              case 'hour':
                return $localize`:@@time-since.hour.ago:${counter}:INTERPOLATION: hour ago`;
                break;
              case 'minute':
                if (document.body.clientWidth < 768) {
                  return $localize`:@@time-since.min.ago:${counter}:INTERPOLATION: min ago`;
                }
                return $localize`:@@time-since.minute.ago:${counter}:INTERPOLATION: minute ago`;
              case 'second':
                if (document.body.clientWidth < 768) {
                  return $localize`:@@time-since.sec.ago:${counter}:INTERPOLATION: sec ago`;
                }
                return $localize`:@@time-since.second.ago:${counter}:INTERPOLATION: second ago`;
            }
          } else {
            switch (
              i // plural (2 days ago)
            ) {
              case 'year':
                return $localize`:@@time-since.years.ago:${counter}:INTERPOLATION: years ago`;
                break;
              case 'month':
                return $localize`:@@time-since.months.ago:${counter}:INTERPOLATION: months ago`;
                break;
              case 'week':
                return $localize`:@@time-since.weeks.ago:${counter}:INTERPOLATION: weeks ago`;
                break;
              case 'day':
                return $localize`:@@time-since.days.ago:${counter}:INTERPOLATION: days ago`;
                break;
              case 'hour':
                return $localize`:@@time-since.hours.ago:${counter}:INTERPOLATION: hours ago`;
                break;
              case 'minute':
                if (document.body.clientWidth < 768) {
                  return $localize`:@@time-since.mins.ago:${counter}:INTERPOLATION: mins ago`;
                }
                return $localize`:@@time-since.minutes.ago:${counter}:INTERPOLATION: minutes ago`;
              case 'second':
                if (document.body.clientWidth < 768) {
                  return $localize`:@@time-since.secs.ago:${counter}:INTERPOLATION: secs ago`;
                }
                return $localize`:@@time-since.seconds.ago:${counter}:INTERPOLATION: seconds ago`;
            }
          }
        }
      }
    }
  }
}
