import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, Input, ChangeDetectorRef, OnChanges } from '@angular/core';
import { StateService } from '../../services/state.service';
import { dates } from '../../shared/i18n/dates';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-time',
  templateUrl: './time.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeComponent implements OnInit, OnChanges, OnDestroy {
  interval: number;
  text: string;
  tooltip: string;
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
  @Input() kind: 'plain' | 'since' | 'until' | 'span' | 'before' | 'within' = 'plain';
  @Input() fastRender = false;
  @Input() fixedRender = false;
  @Input() showTooltip = false;
  @Input() relative = false;
  @Input() precision: number = 0;
  @Input() numUnits: number = 1;
  @Input() units: string[] = ['year', 'month', 'week', 'day', 'hour', 'minute', 'second'];
  @Input() minUnit: 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second' = 'second';
  @Input() fractionDigits: number = 0;
  @Input() lowercaseStart = false;

  constructor(
    private ref: ChangeDetectorRef,
    private stateService: StateService,
    private datePipe: DatePipe,
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
    if (this.time == null) {
      return;
    }

    let seconds: number;
    switch (this.kind) {
      case 'since':
        seconds = Math.floor((+new Date() - +new Date(this.dateString || this.time * 1000)) / 1000);
        this.tooltip = this.datePipe.transform(new Date(this.dateString || this.time * 1000), 'yyyy-MM-dd HH:mm');
        break;
      case 'until':
      case 'within':
        seconds = (+new Date(this.time) - +new Date()) / 1000;
        this.tooltip = this.datePipe.transform(new Date(this.time), 'yyyy-MM-dd HH:mm');
        break;
      default:
        seconds = Math.floor(this.time);
        this.tooltip = '';
    }

    if (!this.showTooltip || this.relative) {
      this.tooltip = '';
    }

    if (seconds < 1 && this.kind === 'span') {
      return $localize`:@@date-base.immediately:Immediately`;
    } else if (seconds < 60) {
      if (this.relative || this.kind === 'since') {
        if (this.lowercaseStart) {
          return $localize`:@@date-base.just-now:Just now`.charAt(0).toLowerCase() + $localize`:@@date-base.just-now:Just now`.slice(1);
        }
        return $localize`:@@date-base.just-now:Just now`;
      } else if (this.kind === 'until' || this.kind === 'within') {
        seconds = 60;
      }
    }

    let counter: number;
    const result = [];
    let usedUnits = 0;
    for (const [index, unit] of this.units.entries()) {
      let precisionUnit = this.units[Math.min(this.units.length - 1, index + this.precision)];
      counter = Math.floor(seconds / this.intervals[unit]);
      const precisionCounter = Math.round(seconds / this.intervals[precisionUnit]);
      if (precisionCounter > this.precisionThresholds[precisionUnit]) {
        precisionUnit = unit;
      }
      if (this.units.indexOf(precisionUnit) === this.units.indexOf(this.minUnit)) {
        counter = Math.max(1, counter);
      }
      if (counter > 0) {
        let rounded;
        const roundFactor = Math.pow(10,this.fractionDigits || 0);
        if ((this.kind === 'until' || this.kind === 'within') && usedUnits < this.numUnits) {
          rounded = Math.floor((seconds / this.intervals[precisionUnit]) * roundFactor) / roundFactor;
        } else {
          rounded = Math.round((seconds / this.intervals[precisionUnit]) * roundFactor) / roundFactor;
        }
        if ((this.kind !== 'until' && this.kind !== 'within')|| this.numUnits === 1) {
          return this.formatTime(this.kind, precisionUnit, rounded);
        } else {
          if (!usedUnits) {
            result.push(this.formatTime(this.kind, precisionUnit, rounded));
          } else {
            result.push(this.formatTime('', precisionUnit, rounded));
          }
          seconds -= (rounded * this.intervals[precisionUnit]);
          usedUnits++;
          if (usedUnits >= this.numUnits) {
            return result.join(', ');
          }
        }
      }
    }
    return result.join(', ');
  }

  private formatTime(kind, unit, number): string {
    const dateStrings = dates(number);
    switch (kind) {
      case 'since':
        if (number === 1) {
          switch (unit) { // singular (1 day)
            case 'year': return $localize`:@@time-since:${dateStrings.i18nYear}:DATE: ago`; break;
            case 'month': return $localize`:@@time-since:${dateStrings.i18nMonth}:DATE: ago`; break;
            case 'week': return $localize`:@@time-since:${dateStrings.i18nWeek}:DATE: ago`; break;
            case 'day': return $localize`:@@time-since:${dateStrings.i18nDay}:DATE: ago`; break;
            case 'hour': return $localize`:@@time-since:${dateStrings.i18nHour}:DATE: ago`; break;
            case 'minute': return $localize`:@@time-since:${dateStrings.i18nMinute}:DATE: ago`; break;
            case 'second': return $localize`:@@time-since:${dateStrings.i18nSecond}:DATE: ago`; break;
          }
        } else {
          switch (unit) { // plural (2 days)
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
        if (number === 1) {
          switch (unit) { // singular (In ~1 day)
            case 'year': return $localize`:@@time-until:In ~${dateStrings.i18nYear}:DATE:`; break;
            case 'month': return $localize`:@@time-until:In ~${dateStrings.i18nMonth}:DATE:`; break;
            case 'week': return $localize`:@@time-until:In ~${dateStrings.i18nWeek}:DATE:`; break;
            case 'day': return $localize`:@@time-until:In ~${dateStrings.i18nDay}:DATE:`; break;
            case 'hour': return $localize`:@@time-until:In ~${dateStrings.i18nHour}:DATE:`; break;
            case 'minute': return $localize`:@@time-until:In ~${dateStrings.i18nMinute}:DATE:`;
            case 'second': return $localize`:@@time-until:In ~${dateStrings.i18nSecond}:DATE:`;
          }
        } else {
          switch (unit) { // plural (In ~2 days)
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
      case 'within':
        if (number === 1) {
          switch (unit) { // singular (In ~1 day)
            case 'year': return $localize`:@@time-within:within ~${dateStrings.i18nYear}:DATE:`; break;
            case 'month': return $localize`:@@time-within:within ~${dateStrings.i18nMonth}:DATE:`; break;
            case 'week': return $localize`:@@time-within:within ~${dateStrings.i18nWeek}:DATE:`; break;
            case 'day': return $localize`:@@time-within:within ~${dateStrings.i18nDay}:DATE:`; break;
            case 'hour': return $localize`:@@time-within:within ~${dateStrings.i18nHour}:DATE:`; break;
            case 'minute': return $localize`:@@time-within:within ~${dateStrings.i18nMinute}:DATE:`;
            case 'second': return $localize`:@@time-within:within ~${dateStrings.i18nSecond}:DATE:`;
          }
        } else {
          switch (unit) { // plural (In ~2 days)
            case 'year': return $localize`:@@time-within:within ~${dateStrings.i18nYears}:DATE:`; break;
            case 'month': return $localize`:@@time-within:within ~${dateStrings.i18nMonths}:DATE:`; break;
            case 'week': return $localize`:@@time-within:within ~${dateStrings.i18nWeeks}:DATE:`; break;
            case 'day': return $localize`:@@time-within:within ~${dateStrings.i18nDays}:DATE:`; break;
            case 'hour': return $localize`:@@time-within:within ~${dateStrings.i18nHours}:DATE:`; break;
            case 'minute': return $localize`:@@time-within:within ~${dateStrings.i18nMinutes}:DATE:`; break;
            case 'second': return $localize`:@@time-within:within ~${dateStrings.i18nSeconds}:DATE:`; break;
          }
        }
        break;
      case 'span':
        if (number === 1) {
          switch (unit) { // singular (1 day)
            case 'year': return $localize`:@@time-span:After ${dateStrings.i18nYear}:DATE:`; break;
            case 'month': return $localize`:@@time-span:After ${dateStrings.i18nMonth}:DATE:`; break;
            case 'week': return $localize`:@@time-span:After ${dateStrings.i18nWeek}:DATE:`; break;
            case 'day': return $localize`:@@time-span:After ${dateStrings.i18nDay}:DATE:`; break;
            case 'hour': return $localize`:@@time-span:After ${dateStrings.i18nHour}:DATE:`; break;
            case 'minute': return $localize`:@@time-span:After ${dateStrings.i18nMinute}:DATE:`; break;
            case 'second': return $localize`:@@time-span:After ${dateStrings.i18nSecond}:DATE:`; break;
          }
        } else {
          switch (unit) { // plural (2 days)
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
      case 'before':
      if (number === 1) {
        switch (unit) { // singular (1 day)
          case 'year': return $localize`:@@time-before:${dateStrings.i18nYear}:DATE: before`; break;
          case 'month': return $localize`:@@time-before:${dateStrings.i18nMonth}:DATE: before`; break;
          case 'week': return $localize`:@@time-before:${dateStrings.i18nWeek}:DATE: before`; break;
          case 'day': return $localize`:@@time-before:${dateStrings.i18nDay}:DATE: before`; break;
          case 'hour': return $localize`:@@time-before:${dateStrings.i18nHour}:DATE: before`; break;
          case 'minute': return $localize`:@@time-before:${dateStrings.i18nMinute}:DATE: before`; break;
          case 'second': return $localize`:@@time-before:${dateStrings.i18nSecond}:DATE: before`; break;
        }
      } else {
        switch (unit) { // plural (2 days)
          case 'year': return $localize`:@@time-before:${dateStrings.i18nYears}:DATE: before`; break;
          case 'month': return $localize`:@@time-before:${dateStrings.i18nMonths}:DATE: before`; break;
          case 'week': return $localize`:@@time-before:${dateStrings.i18nWeeks}:DATE: before`; break;
          case 'day': return $localize`:@@time-before:${dateStrings.i18nDays}:DATE: before`; break;
          case 'hour': return $localize`:@@time-before:${dateStrings.i18nHours}:DATE: before`; break;
          case 'minute': return $localize`:@@time-before:${dateStrings.i18nMinutes}:DATE: before`; break;
          case 'second': return $localize`:@@time-before:${dateStrings.i18nSeconds}:DATE: before`; break;
        }
      }
      break;
      default:
        if (number === 1) {
          switch (unit) { // singular (1 day)
            case 'year': return dateStrings.i18nYear; break;
            case 'month': return dateStrings.i18nMonth; break;
            case 'week': return dateStrings.i18nWeek; break;
            case 'day': return dateStrings.i18nDay; break;
            case 'hour': return dateStrings.i18nHour; break;
            case 'minute': return dateStrings.i18nMinute; break;
            case 'second': return dateStrings.i18nSecond; break;
          }
        } else {
          switch (unit) { // plural (2 days)
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
