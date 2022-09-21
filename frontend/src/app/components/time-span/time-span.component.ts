import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, Input, ChangeDetectorRef, OnChanges } from '@angular/core';
import { StateService } from '../../services/state.service';
import { dates } from '../../shared/i18n/dates';

@Component({
  selector: 'app-time-span',
  template: `{{ text }}`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeSpanComponent implements OnInit, OnChanges, OnDestroy {
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
    const seconds = Math.floor(this.time);
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
              case 'year': return $localize`:@@time-span:After ${dateStrings.i18nYear}:DATE:`; break;
              case 'month': return $localize`:@@time-span:After ${dateStrings.i18nMonth}:DATE:`; break;
              case 'week': return $localize`:@@time-span:After ${dateStrings.i18nWeek}:DATE:`; break;
              case 'day': return $localize`:@@time-span:After ${dateStrings.i18nDay}:DATE:`; break;
              case 'hour': return $localize`:@@time-span:After ${dateStrings.i18nHour}:DATE:`; break;
              case 'minute': return $localize`:@@time-span:After ${dateStrings.i18nMinute}:DATE:`; break;
              case 'second': return $localize`:@@time-span:After ${dateStrings.i18nSecond}:DATE:`; break;
            }
          } else {
            switch (i) { // plural (2 days)
              case 'year': return $localize`:@@time-span:After ${dateStrings.i18nYears}:DATE:`; break;
              case 'month': return $localize`:@@time-span:After ${dateStrings.i18nMonths}:DATE:`; break;
              case 'week': return $localize`:@@time-span:After ${dateStrings.i18nWeeks}:DATE:`; break;
              case 'day': return $localize`:@@time-span:After ${dateStrings.i18nDays}:DATE:`; break;
              case 'hour': return $localize`:@@time-span:After ${dateStrings.i18nHours}:DATE:`; break;
              case 'minute': return $localize`:@@time-span:After ${dateStrings.i18nMinutes}:DATE:`; break;
              case 'second': return $localize`:@@time-span:After ${dateStrings.i18nSeconds}:DATE:`; break;
            }
          }
        }
      }
    }
  }

}
