import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, Input, ChangeDetectorRef, OnChanges } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { dates } from 'src/app/shared/i18n/dates';

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
  @Input() dateString: number;
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
    let date: Date;
    if (this.dateString) {
      date = new Date(this.dateString)
    } else {
      date = new Date(this.time * 1000);
    }
    const seconds = Math.floor((+new Date() - +date) / 1000);
    if (seconds < 60) {
      return $localize`:@@date-base.just-now:Just now`;
    }
    let counter: number;
    for (const i in this.intervals) {
      if (this.intervals.hasOwnProperty(i)) {
        counter = Math.floor(seconds / this.intervals[i]);
        const dateStrings = dates(counter);
        if (counter > 0) {
          if (counter === 1) {
            switch (i) { // singular (1 day)
              case 'year': return $localize`:@@time-since:${dateStrings.i18nYear}:DATE: ago`; break;
              case 'month': return $localize`:@@time-since:${dateStrings.i18nMonth}:DATE: ago`; break;
              case 'week': return $localize`:@@time-since:${dateStrings.i18nWeek}:DATE: ago`; break;
              case 'day': return $localize`:@@time-since:${dateStrings.i18nDay}:DATE: ago`; break;
              case 'hour': return $localize`:@@time-since:${dateStrings.i18nHour}:DATE: ago`; break;
              case 'minute': return $localize`:@@time-since:${dateStrings.i18nMinute}:DATE: ago`; break;
              case 'second': return $localize`:@@time-since:${dateStrings.i18nSecond}:DATE: ago`; break;
            }
          } else {
            switch (i) { // plural (2 days)
              case 'year': return $localize`:@@time-since:${dateStrings.i18nYears}:DATE: ago`; break;
              case 'month': return $localize`:@@time-since:${dateStrings.i18nMonths}:DATE: ago`; break;
              case 'week': return $localize`:@@time-since:${dateStrings.i18nWeeks}:DATE: ago`; break;
              case 'day': return $localize`:@@time-since:${dateStrings.i18nDays}:DATE: ago`; break;
              case 'hour': return $localize`:@@time-since:${dateStrings.i18nHours}:DATE: ago`; break;
              case 'minute': return $localize`:@@time-since:${dateStrings.i18nMinutes}:DATE: ago`; break;
              case 'second': return $localize`:@@time-since:${dateStrings.i18nSeconds}:DATE: ago`; break;
            }
          }
        }
      }
    }
  }

}
