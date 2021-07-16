import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, Input, ChangeDetectorRef, OnChanges } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { dates } from 'src/app/shared/i18n/dates';

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
      return $localize`:@@date-base.last-minute:In ~1 min`;
    }
    let counter;
    for (const i in this.intervals) {
      if (this.intervals.hasOwnProperty(i)) {
        counter = Math.floor(seconds / this.intervals[i]);
        const dateStrings = dates(counter);
        if (counter > 0) {
          if (counter === 1) {
            switch (i) { // singular (In ~1 day)
              case 'year': return $localize`:@@time-until:In ~${dateStrings.i18nYear}:DATE:`; break;
              case 'month': return $localize`:@@time-until:In ~${dateStrings.i18nMonth}:DATE:`; break;
              case 'week': return $localize`:@@time-until:In ~${dateStrings.i18nWeek}:DATE:`; break;
              case 'day': return $localize`:@@time-until:In ~${dateStrings.i18nDay}:DATE:`; break;
              case 'hour': return $localize`:@@time-until:In ~${dateStrings.i18nHour}:DATE:`; break;
              case 'minute':
                if (document.body.clientWidth < 768) {
                  return $localize`:@@time-until:In ~${dateStrings.i18nMin}:DATE:`;
                }
                return $localize`:@@time-until:In ~${dateStrings.i18nMinute}:DATE:`;
              case 'second':
                if (document.body.clientWidth < 768) {
                  return $localize`:@@time-until:In ~${dateStrings.i18nSec}:DATE:`;
                }
                return $localize`:@@time-until:In ~${dateStrings.i18nSecond}:DATE:`;
            }
          } else {
            switch (i) { // plural (In ~2 days)
              case 'year': return $localize`:@@time-until:In ~${dateStrings.i18nYears}:DATE:`; break;
              case 'month': return $localize`:@@time-until:In ~${dateStrings.i18nMonths}:DATE:`; break;
              case 'week': return $localize`:@@time-until:In ~${dateStrings.i18nWeeks}:DATE:`; break;
              case 'day': return $localize`:@@time-until:In ~${dateStrings.i18nDays}:DATE:`; break;
              case 'hour': return $localize`:@@time-until:In ~${dateStrings.i18nHours}:DATE:`; break;
              case 'minute':
                if (document.body.clientWidth < 768) {
                  return $localize`:@@time-until:In ~${dateStrings.i18nMins}:DATE:`;
                }
                return $localize`:@@time-until:In ~${dateStrings.i18nMinutes}:DATE:`;
              case 'second':
                if (document.body.clientWidth < 768) {
                  return $localize`:@@time-until:In ~${dateStrings.i18nSecs}:DATE:`;
                }
                return $localize`:@@time-until:In ~${dateStrings.i18nSeconds}:DATE:`;
            }
          }
        }
      }
    }
  }

}
