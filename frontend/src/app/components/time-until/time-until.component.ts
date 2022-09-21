import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, Input, ChangeDetectorRef, OnChanges } from '@angular/core';
import { StateService } from '../../services/state.service';
import { dates } from '../../shared/i18n/dates';

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
  @Input() fixedRender = false;
  @Input() forceFloorOnTimeIntervals: string[];

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
    if(this.fixedRender){
      this.text = this.calculate();
      return;
    }
    
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
    const seconds = (+new Date(this.time) - +new Date()) / 1000;

    if (seconds < 60) {
      const dateStrings = dates(1);
      return $localize`:@@time-until:In ~${dateStrings.i18nMinute}:DATE:`;
    }
    let counter: number;
    for (const i in this.intervals) {
      if (this.intervals.hasOwnProperty(i)) {
        if (this.forceFloorOnTimeIntervals && this.forceFloorOnTimeIntervals.indexOf(i) > -1) {
          counter = Math.floor(seconds / this.intervals[i]);
        } else {
          counter = Math.round(seconds / this.intervals[i]);
        }
        const dateStrings = dates(counter);
        if (counter > 0) {
          if (counter === 1) {
            switch (i) { // singular (In ~1 day)
              case 'year': return $localize`:@@time-until:In ~${dateStrings.i18nYear}:DATE:`; break;
              case 'month': return $localize`:@@time-until:In ~${dateStrings.i18nMonth}:DATE:`; break;
              case 'week': return $localize`:@@time-until:In ~${dateStrings.i18nWeek}:DATE:`; break;
              case 'day': return $localize`:@@time-until:In ~${dateStrings.i18nDay}:DATE:`; break;
              case 'hour': return $localize`:@@time-until:In ~${dateStrings.i18nHour}:DATE:`; break;
              case 'minute': return $localize`:@@time-until:In ~${dateStrings.i18nMinute}:DATE:`;
              case 'second': return $localize`:@@time-until:In ~${dateStrings.i18nSecond}:DATE:`;
            }
          } else {
            switch (i) { // plural (In ~2 days)
              case 'year': return $localize`:@@time-until:In ~${dateStrings.i18nYears}:DATE:`; break;
              case 'month': return $localize`:@@time-until:In ~${dateStrings.i18nMonths}:DATE:`; break;
              case 'week': return $localize`:@@time-until:In ~${dateStrings.i18nWeeks}:DATE:`; break;
              case 'day': return $localize`:@@time-until:In ~${dateStrings.i18nDays}:DATE:`; break;
              case 'hour': return $localize`:@@time-until:In ~${dateStrings.i18nHours}:DATE:`; break;
              case 'minute': return $localize`:@@time-until:In ~${dateStrings.i18nMinutes}:DATE:`; break;
              case 'second': return $localize`:@@time-until:In ~${dateStrings.i18nSeconds}:DATE:`; break;
            }
          }
        }
      }
    }
  }

}
