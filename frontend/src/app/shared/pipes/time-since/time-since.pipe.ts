import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'timeSince' })
export class TimeSincePipe implements PipeTransform {
  transform(timestamp: number) {
    const minutes = ((new Date().getTime()) - (new Date(timestamp * 1000).getTime())) / 1000 / 60;
    if (minutes >= 120) {
      return Math.floor(minutes / 60) + ' hours';
    }
    if (minutes >= 60) {
      return Math.floor(minutes / 60) + ' hour';
    }
    if (minutes <= 1) {
      return '< 1 minute';
    }
    if (minutes === 1) {
      return '1 minute';
    }
    return Math.round(minutes) + ' minutes';
  }
}
