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
  intervals = {};

  @Input() time: number;
  @Input() dateString: number;
  @Input() kind: 'plain' | 'since' | 'until' | 'span' = 'plain';
  @Input() fastRender = false;
  @Input() fixedRender = false;
  @Input() relative = false;
  @Input() forceFloorOnTimeIntervals: string[];

  constructor(
    private ref: ChangeDetectorRef,
    private stateService: StateService,
  ) {
      this.intervals = {
        Year: 31536000,
        Month: 2592000,
        Week: 604800,
        Day: 86400,
        Hour: 3600,
        Minute: 60,
        Second: 1
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
    for (const i in this.intervals) {
      if (this.kind !== 'until' || this.forceFloorOnTimeIntervals && this.forceFloorOnTimeIntervals.indexOf(i.toLowerCase()) > -1) {
        counter = Math.floor(seconds / this.intervals[i]);
      } else {
        counter = Math.round(seconds / this.intervals[i]);
      }
      const dateStrings = dates(counter);
      if (counter > 0) {
        const dateStringKey = `i18n${i}${counter === 1 ? '' : 's'}`;
        switch (this.kind) {
          case 'since':
            return $localize`:@@time-since:${dateStrings[dateStringKey]}:DATE: ago`;
          case 'until':
            return $localize`:@@time-until:In ~${dateStrings[dateStringKey]}:DATE:`;
          case 'span':
            return $localize`:@@time-span:After ${dateStrings[dateStringKey]}:DATE:`;
          default:
            return dateStrings[dateStringKey];
        }
      }
    }
  }

}
