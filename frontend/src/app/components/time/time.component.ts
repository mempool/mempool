import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, Input, ChangeDetectorRef, OnChanges } from '@angular/core';
import { StateService } from '../../services/state.service';
import { dates } from '../../shared/i18n/dates';

@Component({
  selector: 'app-time',
  template: `{{ text }}`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeComponent implements OnInit, OnChanges, OnDestroy {
  interval: number;
  text: string;
  units: string[] = ['year', 'month', 'week', 'day', 'hour', 'minute', 'second'];
  precisionThresholds = {
    year: 100,
    month: 18,
    week: 12,
    day: 31,
    hour: 48,
    minute: 90,
    second: 90
  };
  intervals = {};

  @Input() time: number;
  @Input() dateString: number;
  @Input() kind: 'plain' | 'since' | 'until' | 'span' = 'plain';
  @Input() fastRender = false;
  @Input() fixedRender = false;
  @Input() relative = false;
  @Input() precision: number = 0;
  @Input() fractionDigits: number = 0;

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
    let seconds: number;
    switch (this.kind) {
      case 'since':
        seconds = Math.floor((+new Date() - +new Date(this.dateString || this.time * 1000)) / 1000);
        break;
      case 'until':
        seconds = (+new Date(this.time) - +new Date()) / 1000;
        break;
      default:
        seconds = Math.floor(this.time);
    }

    if (seconds < 60) {
      if (this.relative || this.kind === 'since') {
        return $localize`:@@date-base.just-now:Just now`;
      } else if (this.kind === 'until') {
        seconds = 60;
      }
    }

    let counter: number;
    for (const [index, unit] of this.units.entries()) {
      let precisionUnit = this.units[Math.min(this.units.length - 1, index + this.precision)];
      counter = Math.floor(seconds / this.intervals[unit]);
      const precisionCounter = Math.floor(seconds / this.intervals[precisionUnit]);
      if (precisionCounter > this.precisionThresholds[precisionUnit]) {
        precisionUnit = unit;
      }
      if (counter > 0) {
        let rounded = Math.round(seconds / this.intervals[precisionUnit]);
        if (this.fractionDigits) {
          const roundFactor = Math.pow(10,this.fractionDigits);
          rounded = Math.round((seconds / this.intervals[precisionUnit]) * roundFactor) / roundFactor;
        }
        const dateStrings = dates(rounded);
        switch (this.kind) {
          case 'since':
            if (rounded === 1) {
              switch (precisionUnit) { // singular (1 day)
                case 'year': return $localize`:@@time-since:${dateStrings.i18nYear}:DATE: ago`; break;
                case 'month': return $localize`:@@time-since:${dateStrings.i18nMonth}:DATE: ago`; break;
                case 'week': return $localize`:@@time-since:${dateStrings.i18nWeek}:DATE: ago`; break;
                case 'day': return $localize`:@@time-since:${dateStrings.i18nDay}:DATE: ago`; break;
                case 'hour': return $localize`:@@time-since:${dateStrings.i18nHour}:DATE: ago`; break;
                case 'minute': return $localize`:@@time-since:${dateStrings.i18nMinute}:DATE: ago`; break;
                case 'second': return $localize`:@@time-since:${dateStrings.i18nSecond}:DATE: ago`; break;
              }
            } else {
              switch (precisionUnit) { // plural (2 days)
                case 'year': return $localize`:@@time-since:${dateStrings.i18nYears}:DATE: ago`; break;
                case 'month': return $localize`:@@time-since:${dateStrings.i18nMonths}:DATE: ago`; break;
                case 'week': return $localize`:@@time-since:${dateStrings.i18nWeeks}:DATE: ago`; break;
                case 'day': return $localize`:@@time-since:${dateStrings.i18nDays}:DATE: ago`; break;
                case 'hour': return $localize`:@@time-since:${dateStrings.i18nHours}:DATE: ago`; break;
                case 'minute': return $localize`:@@time-since:${dateStrings.i18nMinutes}:DATE: ago`; break;
                case 'second': return $localize`:@@time-since:${dateStrings.i18nSeconds}:DATE: ago`; break;
              }
            }
            break;
          case 'until':
            if (rounded === 1) {
              switch (precisionUnit) { // singular (In ~1 day)
                case 'year': return $localize`:@@time-until:In ~${dateStrings.i18nYear}:DATE:`; break;
                case 'month': return $localize`:@@time-until:In ~${dateStrings.i18nMonth}:DATE:`; break;
                case 'week': return $localize`:@@time-until:In ~${dateStrings.i18nWeek}:DATE:`; break;
                case 'day': return $localize`:@@time-until:In ~${dateStrings.i18nDay}:DATE:`; break;
                case 'hour': return $localize`:@@time-until:In ~${dateStrings.i18nHour}:DATE:`; break;
                case 'minute': return $localize`:@@time-until:In ~${dateStrings.i18nMinute}:DATE:`;
                case 'second': return $localize`:@@time-until:In ~${dateStrings.i18nSecond}:DATE:`;
              }
            } else {
              switch (precisionUnit) { // plural (In ~2 days)
                case 'year': return $localize`:@@time-until:In ~${dateStrings.i18nYears}:DATE:`; break;
                case 'month': return $localize`:@@time-until:In ~${dateStrings.i18nMonths}:DATE:`; break;
                case 'week': return $localize`:@@time-until:In ~${dateStrings.i18nWeeks}:DATE:`; break;
                case 'day': return $localize`:@@time-until:In ~${dateStrings.i18nDays}:DATE:`; break;
                case 'hour': return $localize`:@@time-until:In ~${dateStrings.i18nHours}:DATE:`; break;
                case 'minute': return $localize`:@@time-until:In ~${dateStrings.i18nMinutes}:DATE:`; break;
                case 'second': return $localize`:@@time-until:In ~${dateStrings.i18nSeconds}:DATE:`; break;
              }
            }
            break;
          case 'span':
            if (rounded === 1) {
              switch (precisionUnit) { // singular (1 day)
                case 'year': return $localize`:@@time-span:After ${dateStrings.i18nYear}:DATE:`; break;
                case 'month': return $localize`:@@time-span:After ${dateStrings.i18nMonth}:DATE:`; break;
                case 'week': return $localize`:@@time-span:After ${dateStrings.i18nWeek}:DATE:`; break;
                case 'day': return $localize`:@@time-span:After ${dateStrings.i18nDay}:DATE:`; break;
                case 'hour': return $localize`:@@time-span:After ${dateStrings.i18nHour}:DATE:`; break;
                case 'minute': return $localize`:@@time-span:After ${dateStrings.i18nMinute}:DATE:`; break;
                case 'second': return $localize`:@@time-span:After ${dateStrings.i18nSecond}:DATE:`; break;
              }
            } else {
              switch (precisionUnit) { // plural (2 days)
                case 'year': return $localize`:@@time-span:After ${dateStrings.i18nYears}:DATE:`; break;
                case 'month': return $localize`:@@time-span:After ${dateStrings.i18nMonths}:DATE:`; break;
                case 'week': return $localize`:@@time-span:After ${dateStrings.i18nWeeks}:DATE:`; break;
                case 'day': return $localize`:@@time-span:After ${dateStrings.i18nDays}:DATE:`; break;
                case 'hour': return $localize`:@@time-span:After ${dateStrings.i18nHours}:DATE:`; break;
                case 'minute': return $localize`:@@time-span:After ${dateStrings.i18nMinutes}:DATE:`; break;
                case 'second': return $localize`:@@time-span:After ${dateStrings.i18nSeconds}:DATE:`; break;
              }
            }
            break;
          default:
            if (rounded === 1) {
              switch (precisionUnit) { // singular (1 day)
                case 'year': return dateStrings.i18nYear; break;
                case 'month': return dateStrings.i18nMonth; break;
                case 'week': return dateStrings.i18nWeek; break;
                case 'day': return dateStrings.i18nDay; break;
                case 'hour': return dateStrings.i18nHour; break;
                case 'minute': return dateStrings.i18nMinute; break;
                case 'second': return dateStrings.i18nSecond; break;
              }
            } else {
              switch (precisionUnit) { // plural (2 days)
                case 'year': return dateStrings.i18nYears; break;
                case 'month': return dateStrings.i18nMonths; break;
                case 'week': return dateStrings.i18nWeeks; break;
                case 'day': return dateStrings.i18nDays; break;
                case 'hour': return dateStrings.i18nHours; break;
                case 'minute': return dateStrings.i18nMinutes; break;
                case 'second': return dateStrings.i18nSeconds; break;
              }
            }
        }
      }
    }
  }

}
