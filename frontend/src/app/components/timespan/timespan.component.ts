import { Component, ChangeDetectionStrategy, Input, OnChanges } from '@angular/core';

@Component({
  selector: 'app-timespan',
  template: `{{ text }}`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimespanComponent implements OnChanges {
  @Input() time: number;
  text: string;

  constructor() {}

  ngOnChanges() {
    const seconds = this.time;
    if (seconds < 60) {
      this.text = '< 1 minute';
      return;
    }
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
      second: 1,
    };
    let counter;
    for (const i in intervals) {
      if (intervals.hasOwnProperty(i)) {
        counter = Math.floor(seconds / intervals[i]);
        if (counter > 0) {
          if (counter === 1) {
            this.text = counter + ' ' + i; // singular (1 day ago)
            break;
          } else {
            this.text = counter + ' ' + i + 's'; // plural (2 days ago)
            break;
          }
        }
      }
    }
  }
}
