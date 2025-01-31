import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';


@Component({
  selector: 'app-confirmations',
  templateUrl: './confirmations.component.html',
  styleUrls: ['./confirmations.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationsComponent implements OnChanges {
  @Input() chainTip: number;
  @Input() height: number;
  @Input() replaced: boolean = false;
  @Input() removed: boolean = false;
  @Input() cached: boolean = false;
  @Input() hideUnconfirmed: boolean = false;
  @Input() buttonClass: string = '';

  confirmations: number = 0;

  ngOnChanges(): void {
    if (this.chainTip != null && this.height != null) {
      this.confirmations = Math.max(1, this.chainTip - this.height + 1);
    } else {
      this.confirmations = 0;
    }
  }
}
