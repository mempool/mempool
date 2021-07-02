import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, Input, ChangeDetectorRef, OnChanges, PLATFORM_ID, Inject } from '@angular/core';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-time-until',
  template: `{{ text }}`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeUntilComponent implements OnInit, OnChanges, OnDestroy {
  interval: number;
  text: string;
  intervals = {};

  @Input() time: number;
  @Input() fastRender = false;

  constructor(
    private ref: ChangeDetectorRef,
    private stateService: StateService,
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
    const seconds = Math.floor((+new Date(this.time) - +new Date()) / 1000);

    if (seconds < 60) {
      return $localize`:@@time-until.any-moment:Any moment`;
    }
    let counter;
    for (const i in this.intervals) {
      if (this.intervals.hasOwnProperty(i)) {
        counter = Math.floor(seconds / this.intervals[i]);
        if (counter > 0) {
          if (counter === 1) {
            switch (i) { // singular (1 day ago)
              case 'year': return $localize`:@@time-until.year:In ~${counter}:INTERPOLATION: year`; break;
              case 'month': return $localize`:@@time-until.month:In ~${counter}:INTERPOLATION: month`; break;
              case 'week': return $localize`:@@time-until.week:In ~${counter}:INTERPOLATION: week`; break;
              case 'day': return $localize`:@@time-until.day:In ~${counter}:INTERPOLATION: day`; break;
              case 'hour': return $localize`:@@time-until.hour:In ~${counter}:INTERPOLATION: hour`; break;
              case 'minute':
                if (document.body.clientWidth < 768) {
                  return $localize`:@@time-until.min:In ~${counter}:INTERPOLATION: min`;
                }
                return $localize`:@@time-until.minute:In ~${counter}:INTERPOLATION: minute`;
              case 'second':
                if (document.body.clientWidth < 768) {
                  return $localize`:@@time-until.sec:In ~${counter}:INTERPOLATION: sec`;
                }
                return $localize`:@@time-until.second:In ~${counter}:INTERPOLATION: second`;
            }
          } else {
            switch (i) { // plural (2 days ago)
              case 'year': return $localize`:@@time-until.years:In ~${counter}:INTERPOLATION: years`; break;
              case 'month': return $localize`:@@time-until.months:In ~${counter}:INTERPOLATION: months`; break;
              case 'week': return $localize`:@@time-until.weeks:In ~${counter}:INTERPOLATION: weeks`; break;
              case 'day': return $localize`:@@time-until.days:In ~${counter}:INTERPOLATION: days`; break;
              case 'hour': return $localize`:@@time-until.hours:In ~${counter}:INTERPOLATION: hours`; break;
              case 'minute':
                if (document.body.clientWidth < 768) {
                  return $localize`:@@time-until.mins:In ~${counter}:INTERPOLATION: mins`;
                }
                return $localize`:@@time-until.minutes:In ~${counter}:INTERPOLATION: minutes`;
              case 'second':
                if (document.body.clientWidth < 768) {
                  return $localize`:@@time-until.secs:In ~${counter}:INTERPOLATION: secs`;
                }
                return $localize`:@@time-until.seconds:In ~${counter}:INTERPOLATION: seconds`;
            }
          }
        }
      }
    }
  }

}
