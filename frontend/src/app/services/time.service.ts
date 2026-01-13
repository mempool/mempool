import { Injectable } from '@angular/core';
import { DatePipe } from '@angular/common';
import { dates } from '@app/shared/i18n/dates';

const intervals = {
  year: 31536000,
  month: 2592000,
  week: 604800,
  day: 86400,
  hour: 3600,
  minute: 60,
  second: 1
};

const precisionThresholds = {
  year: 100,
  month: 18,
  week: 12,
  day: 31,
  hour: 48,
  minute: 90,
  second: 90
};

@Injectable({
  providedIn: 'root'
})
export class TimeService {

  constructor(private datePipe: DatePipe) {}

  calculate(
    time: number,
    kind: 'plain' | 'since' | 'until' | 'span' | 'before' | 'within',
    relative: boolean = false,
    precision: number = 0,
    minUnit: 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second' = 'second',
    showTooltip: boolean = false,
    units: string[] = ['year', 'month', 'week', 'day', 'hour', 'minute', 'second'],
    dateString?: string,
    lowercaseStart: boolean = false,
    numUnits: number = 1,
    fractionDigits: number = 0,
  ): { text: string, tooltip: string } {
    if (time == null) {
      return { text: '', tooltip: '' };
    }

    let seconds: number;
    let tooltip: string = '';
    switch (kind) {
      case 'since':
        seconds = Math.floor((+new Date() - +new Date(dateString || time * 1000)) / 1000);
        tooltip = this.datePipe.transform(new Date(dateString || time * 1000), 'yyyy-MM-dd HH:mm') || '';
        break;
      case 'until':
      case 'within':
        seconds = (+new Date(time) - +new Date()) / 1000;
        tooltip = this.datePipe.transform(new Date(time), 'yyyy-MM-dd HH:mm') || '';
        break;
      default:
        seconds = Math.floor(time);
        tooltip = '';
    }

    if (!showTooltip || relative) {
      tooltip = '';
    }

    if (seconds < 1 && kind === 'span') {
      return { tooltip, text: $localize`:@@date-base.immediately:Immediately` };
    } else if (seconds < 60) {
      if (relative || kind === 'since') {
        if (lowercaseStart) {
          return { tooltip, text: $localize`:@@date-base.just-now:Just now`.charAt(0).toLowerCase() + $localize`:@@date-base.just-now:Just now`.slice(1) };
        }
        return { tooltip, text: $localize`:@@date-base.just-now:Just now` };
      } else if (kind === 'until' || kind === 'within') {
        seconds = 60;
      }
    }

    let counter: number;
    const result: string[] = [];
    let usedUnits = 0;
    for (const [index, unit] of units.entries()) {
      let precisionUnit = units[Math.min(units.length - 1, index + precision)];
      counter = Math.floor(seconds / intervals[unit]);
      const precisionCounter = Math.round(seconds / intervals[precisionUnit]);
      if (precisionCounter > precisionThresholds[precisionUnit]) {
        precisionUnit = unit;
      }
      if (units.indexOf(precisionUnit) === units.indexOf(minUnit)) {
        counter = Math.max(1, counter);
      }
      if (counter > 0) {
        let rounded;
        const roundFactor = Math.pow(10,fractionDigits || 0);
        if ((kind === 'until' || kind === 'within') && usedUnits < numUnits) {
          rounded = Math.floor((seconds / intervals[precisionUnit]) * roundFactor) / roundFactor;
        } else {
          rounded = Math.round((seconds / intervals[precisionUnit]) * roundFactor) / roundFactor;
        }
        if ((kind !== 'until' && kind !== 'within')|| numUnits === 1) {
          return { tooltip, text: this.formatTime(kind, precisionUnit, rounded) };
        } else {
          if (!usedUnits) {
            result.push(this.formatTime(kind, precisionUnit, rounded));
          } else {
            result.push(this.formatTime('', precisionUnit, rounded));
          }
          seconds -= (rounded * intervals[precisionUnit]);
          usedUnits++;
          if (usedUnits >= numUnits) {
            return { tooltip, text: result.join(', ') };
          }
        }
      }
    }
    return { tooltip, text: result.join(', ') };
  }

  private formatTime(kind, unit, number): string {
    const dateStrings = dates(number);
    switch (kind) {
      case 'since':
        if (number === 1) {
          switch (unit) { // singular (1 day)
            case 'year': return $localize`:@@time-since:${dateStrings.i18nYear}:DATE: ago`;
            case 'month': return $localize`:@@time-since:${dateStrings.i18nMonth}:DATE: ago`;
            case 'week': return $localize`:@@time-since:${dateStrings.i18nWeek}:DATE: ago`;
            case 'day': return $localize`:@@time-since:${dateStrings.i18nDay}:DATE: ago`;
            case 'hour': return $localize`:@@time-since:${dateStrings.i18nHour}:DATE: ago`;
            case 'minute': return $localize`:@@time-since:${dateStrings.i18nMinute}:DATE: ago`;
            case 'second': return $localize`:@@time-since:${dateStrings.i18nSecond}:DATE: ago`;
          }
        } else {
          switch (unit) { // plural (2 days)
            case 'year': return $localize`:@@time-since:${dateStrings.i18nYears}:DATE: ago`;
            case 'month': return $localize`:@@time-since:${dateStrings.i18nMonths}:DATE: ago`;
            case 'week': return $localize`:@@time-since:${dateStrings.i18nWeeks}:DATE: ago`;
            case 'day': return $localize`:@@time-since:${dateStrings.i18nDays}:DATE: ago`;
            case 'hour': return $localize`:@@time-since:${dateStrings.i18nHours}:DATE: ago`;
            case 'minute': return $localize`:@@time-since:${dateStrings.i18nMinutes}:DATE: ago`;
            case 'second': return $localize`:@@time-since:${dateStrings.i18nSeconds}:DATE: ago`;
          }
        }
        break;
      case 'until':
        if (number === 1) {
          switch (unit) { // singular (In ~1 day)
            case 'year': return $localize`:@@time-until:In ~${dateStrings.i18nYear}:DATE:`;
            case 'month': return $localize`:@@time-until:In ~${dateStrings.i18nMonth}:DATE:`;
            case 'week': return $localize`:@@time-until:In ~${dateStrings.i18nWeek}:DATE:`;
            case 'day': return $localize`:@@time-until:In ~${dateStrings.i18nDay}:DATE:`;
            case 'hour': return $localize`:@@time-until:In ~${dateStrings.i18nHour}:DATE:`;
            case 'minute': return $localize`:@@time-until:In ~${dateStrings.i18nMinute}:DATE:`;
            case 'second': return $localize`:@@time-until:In ~${dateStrings.i18nSecond}:DATE:`;
          }
        } else {
          switch (unit) { // plural (In ~2 days)
            case 'year': return $localize`:@@time-until:In ~${dateStrings.i18nYears}:DATE:`;
            case 'month': return $localize`:@@time-until:In ~${dateStrings.i18nMonths}:DATE:`;
            case 'week': return $localize`:@@time-until:In ~${dateStrings.i18nWeeks}:DATE:`;
            case 'day': return $localize`:@@time-until:In ~${dateStrings.i18nDays}:DATE:`;
            case 'hour': return $localize`:@@time-until:In ~${dateStrings.i18nHours}:DATE:`;
            case 'minute': return $localize`:@@time-until:In ~${dateStrings.i18nMinutes}:DATE:`;
            case 'second': return $localize`:@@time-until:In ~${dateStrings.i18nSeconds}:DATE:`;
          }
        }
        break;
      case 'within':
        if (number === 1) {
          switch (unit) { // singular (In ~1 day)
            case 'year': return $localize`:@@time-within:within ~${dateStrings.i18nYear}:DATE:`;
            case 'month': return $localize`:@@time-within:within ~${dateStrings.i18nMonth}:DATE:`;
            case 'week': return $localize`:@@time-within:within ~${dateStrings.i18nWeek}:DATE:`;
            case 'day': return $localize`:@@time-within:within ~${dateStrings.i18nDay}:DATE:`;
            case 'hour': return $localize`:@@time-within:within ~${dateStrings.i18nHour}:DATE:`;
            case 'minute': return $localize`:@@time-within:within ~${dateStrings.i18nMinute}:DATE:`;
            case 'second': return $localize`:@@time-within:within ~${dateStrings.i18nSecond}:DATE:`;
          }
        } else {
          switch (unit) { // plural (In ~2 days)
            case 'year': return $localize`:@@time-within:within ~${dateStrings.i18nYears}:DATE:`;
            case 'month': return $localize`:@@time-within:within ~${dateStrings.i18nMonths}:DATE:`;
            case 'week': return $localize`:@@time-within:within ~${dateStrings.i18nWeeks}:DATE:`;
            case 'day': return $localize`:@@time-within:within ~${dateStrings.i18nDays}:DATE:`;
            case 'hour': return $localize`:@@time-within:within ~${dateStrings.i18nHours}:DATE:`;
            case 'minute': return $localize`:@@time-within:within ~${dateStrings.i18nMinutes}:DATE:`;
            case 'second': return $localize`:@@time-within:within ~${dateStrings.i18nSeconds}:DATE:`;
          }
        }
        break;
      case 'span':
        if (number === 1) {
          switch (unit) { // singular (1 day)
            case 'year': return $localize`:@@time-span:After ${dateStrings.i18nYear}:DATE:`;
            case 'month': return $localize`:@@time-span:After ${dateStrings.i18nMonth}:DATE:`;
            case 'week': return $localize`:@@time-span:After ${dateStrings.i18nWeek}:DATE:`;
            case 'day': return $localize`:@@time-span:After ${dateStrings.i18nDay}:DATE:`;
            case 'hour': return $localize`:@@time-span:After ${dateStrings.i18nHour}:DATE:`;
            case 'minute': return $localize`:@@time-span:After ${dateStrings.i18nMinute}:DATE:`;
            case 'second': return $localize`:@@time-span:After ${dateStrings.i18nSecond}:DATE:`;
          }
        } else {
          switch (unit) { // plural (2 days)
            case 'year': return $localize`:@@time-span:After ${dateStrings.i18nYears}:DATE:`;
            case 'month': return $localize`:@@time-span:After ${dateStrings.i18nMonths}:DATE:`;
            case 'week': return $localize`:@@time-span:After ${dateStrings.i18nWeeks}:DATE:`;
            case 'day': return $localize`:@@time-span:After ${dateStrings.i18nDays}:DATE:`;
            case 'hour': return $localize`:@@time-span:After ${dateStrings.i18nHours}:DATE:`;
            case 'minute': return $localize`:@@time-span:After ${dateStrings.i18nMinutes}:DATE:`;
            case 'second': return $localize`:@@time-span:After ${dateStrings.i18nSeconds}:DATE:`;
          }
        }
        break;
      case 'before':
      if (number === 1) {
        switch (unit) { // singular (1 day)
          case 'year': return $localize`:@@time-before:${dateStrings.i18nYear}:DATE: before`;
          case 'month': return $localize`:@@time-before:${dateStrings.i18nMonth}:DATE: before`;
          case 'week': return $localize`:@@time-before:${dateStrings.i18nWeek}:DATE: before`;
          case 'day': return $localize`:@@time-before:${dateStrings.i18nDay}:DATE: before`;
          case 'hour': return $localize`:@@time-before:${dateStrings.i18nHour}:DATE: before`;
          case 'minute': return $localize`:@@time-before:${dateStrings.i18nMinute}:DATE: before`;
          case 'second': return $localize`:@@time-before:${dateStrings.i18nSecond}:DATE: before`;
        }
      } else {
        switch (unit) { // plural (2 days)
          case 'year': return $localize`:@@time-before:${dateStrings.i18nYears}:DATE: before`;
          case 'month': return $localize`:@@time-before:${dateStrings.i18nMonths}:DATE: before`;
          case 'week': return $localize`:@@time-before:${dateStrings.i18nWeeks}:DATE: before`;
          case 'day': return $localize`:@@time-before:${dateStrings.i18nDays}:DATE: before`;
          case 'hour': return $localize`:@@time-before:${dateStrings.i18nHours}:DATE: before`;
          case 'minute': return $localize`:@@time-before:${dateStrings.i18nMinutes}:DATE: before`;
          case 'second': return $localize`:@@time-before:${dateStrings.i18nSeconds}:DATE: before`;
        }
      }
      break;
      default:
        if (number === 1) {
          switch (unit) { // singular (1 day)
            case 'year': return dateStrings.i18nYear;
            case 'month': return dateStrings.i18nMonth;
            case 'week': return dateStrings.i18nWeek;
            case 'day': return dateStrings.i18nDay;
            case 'hour': return dateStrings.i18nHour;
            case 'minute': return dateStrings.i18nMinute;
            case 'second': return dateStrings.i18nSecond;
          }
        } else {
          switch (unit) { // plural (2 days)
            case 'year': return dateStrings.i18nYears;
            case 'month': return dateStrings.i18nMonths;
            case 'week': return dateStrings.i18nWeeks;
            case 'day': return dateStrings.i18nDays;
            case 'hour': return dateStrings.i18nHours;
            case 'minute': return dateStrings.i18nMinutes;
            case 'second': return dateStrings.i18nSeconds;
          }
        }
    }
    return '';
  }
}
