import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, Input, ChangeDetectorRef, OnChanges } from '@angular/core';
import { StateService } from '@app/services/state.service';
import { TimeService } from '@app/services/time.service';

@Component({
  selector: 'app-time',
  templateUrl: './time.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeComponent implements OnInit, OnChanges, OnDestroy {
  interval: number;
  text: string;
  tooltip: string;

  @Input() time: number;
  @Input() dateString: string;
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
    private timeService: TimeService,
  ) {}

  ngOnInit() {
    this.calculateTime();
    if(this.fixedRender){
      return;
    }
    if (!this.stateService.isBrowser) {
      this.ref.markForCheck();
      return;
    }
    this.interval = window.setInterval(() => {
      this.calculateTime();
      this.ref.markForCheck();
    }, 1000 * (this.fastRender ? 1 : 60));
  }

  ngOnChanges() {
    this.calculateTime();
    this.ref.markForCheck();
  }

  ngOnDestroy() {
    clearInterval(this.interval);
  }

  calculateTime(): void {
    const { text, tooltip } = this.timeService.calculate(
      this.time,
      this.kind,
      this.relative,
      this.precision,
      this.minUnit,
      this.showTooltip,
      this.units,
      this.dateString,
      this.lowercaseStart,
      this.numUnits,
      this.fractionDigits,
    );
    this.text = text;
    this.tooltip = tooltip;
  }
}
