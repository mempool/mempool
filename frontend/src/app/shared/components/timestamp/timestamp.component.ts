import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-timestamp',
  templateUrl: './timestamp.component.html',
  styleUrls: ['./timestamp.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimestampComponent implements OnChanges {
  @Input() unixTime: number;
  @Input() dateString: string;
  @Input() customFormat: string;
  @Input() hideTimeSince: boolean = false;
  @Input() precision: number = 0;
  @Input() minUnit: 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second' = 'second';

  seconds: number | undefined = undefined;

  constructor(
    public stateService: StateService,
  ) { }

  ngOnChanges(): void {
    if (this.unixTime) {
      this.seconds = this.unixTime;
    } else if (this.dateString) {
      this.seconds = new Date(this.dateString).getTime() / 1000;
    }
  }

}
