import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'timeSince' })
export class TimeSincePipe implements PipeTransform {
  transform(value: any, args?: any): any {
    if (value) {
      const seconds = Math.floor((+new Date() - +new Date(value * 1000)) / 1000);
      if (seconds < 60) {
        return '< 1 minute';
      }
      const intervals = {
          year: 31536000,
          month: 2592000,
          week: 604800,
          day: 86400,
          hour: 3600,
          minute: 60,
          second: 1
      };
      let counter;
      for (const i in intervals) {
        if (intervals.hasOwnProperty(i)) {
          counter = Math.floor(seconds / intervals[i]);
          if (counter > 0) {
            if (counter === 1) {
                return counter + ' ' + i; // singular (1 day ago)
            } else {
                return counter + ' ' + i + 's'; // plural (2 days ago)
            }
          }
        }
      }
    }
    return value;
  }
}
