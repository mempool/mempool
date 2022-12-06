import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-channel-close-box',
  templateUrl: './channel-close-box.component.html',
  styleUrls: ['./channel-close-box.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelCloseBoxComponent implements OnChanges {
  @Input() channel: any;
  @Input() local: any;
  @Input() remote: any;

  showStartingBalance: boolean = false;
  showClosingBalance: boolean = false;
  minStartingBalance: number;
  maxStartingBalance: number;
  minClosingBalance: number;
  maxClosingBalance: number;

  constructor() { }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.channel && this.local && this.remote) {
      this.showStartingBalance = (this.local.funding_balance || this.remote.funding_balance) && this.channel.funding_ratio;
      this.showClosingBalance = this.local.closing_balance || this.remote.closing_balance;

      if (this.channel.single_funded) {
        if (this.local.funding_balance) {
          this.minStartingBalance = this.channel.capacity;
          this.maxStartingBalance = this.channel.capacity;
        } else if (this.remote.funding_balance) {
          this.minStartingBalance = 0;
          this.maxStartingBalance = 0;
        }
      } else {
        this.minStartingBalance = clampRound(0, this.channel.capacity, this.local.funding_balance * this.channel.funding_ratio);
        this.maxStartingBalance = clampRound(0, this.channel.capacity, this.channel.capacity - (this.remote.funding_balance * this.channel.funding_ratio));
      }

      const closingCapacity = this.channel.capacity - this.channel.closing_fee;
      this.minClosingBalance = clampRound(0, closingCapacity, this.local.closing_balance);
      this.maxClosingBalance = clampRound(0, closingCapacity, closingCapacity - this.remote.closing_balance);

      // margin of error to account for 2 x 330 sat anchor outputs
      if (Math.abs(this.minClosingBalance - this.maxClosingBalance) <= 660) {
        this.maxClosingBalance = this.minClosingBalance;
      }
    } else {
      this.showStartingBalance = false;
      this.showClosingBalance = false;
    }
  }
}

function clampRound(min: number, max: number, value: number): number {
  return Math.max(0, Math.min(max, Math.round(value)));
}
