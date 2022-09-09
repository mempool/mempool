import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';

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

  seconds: number | undefined = undefined;

  ngOnChanges(): void {
    if (this.unixTime) {
      this.seconds = this.unixTime;
    } else if (this.dateString) {
      this.seconds = new Date(this.dateString).getTime() / 1000;
    }
  }

}
