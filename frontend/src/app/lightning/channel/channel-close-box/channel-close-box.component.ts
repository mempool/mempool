import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-channel-close-box',
  templateUrl: './channel-close-box.component.html',
  styleUrls: ['./channel-close-box.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelCloseBoxComponent implements OnChanges {
  @Input() channel: any;
  @Input() left: any;
  @Input() right: any;

  showStartingBalance: boolean = false;
  showClosingBalance: boolean = false;
  minStartingBalance: number;
  maxStartingBalance: number;
  minClosingBalance: number;
  maxClosingBalance: number;

  startingBalanceStyle: {
    left: string,
    center: string,
    right: string,
  } = {
    left: '',
    center: '',
    right: '',
  };

  closingBalanceStyle: {
    left: string,
    center: string,
    right: string,
  } = {
    left: '',
    center: '',
    right: '',
  };

  hideStartingLeft: boolean = false;
  hideStartingRight: boolean = false;
  hideClosingLeft: boolean = false;
  hideClosingRight: boolean = false;

  constructor() { }

  ngOnChanges(changes: SimpleChanges): void {
    let closingCapacity;
    if (this.channel && this.left && this.right) {
      this.showStartingBalance = (this.left.funding_balance || this.right.funding_balance) && this.channel.funding_ratio;
      this.showClosingBalance = this.left.closing_balance || this.right.closing_balance;

      if (this.channel.single_funded) {
        if (this.left.funding_balance) {
          this.minStartingBalance = this.channel.capacity;
          this.maxStartingBalance = this.channel.capacity;
        } else if (this.right.funding_balance) {
          this.minStartingBalance = 0;
          this.maxStartingBalance = 0;
        }
      } else {
        this.minStartingBalance = clampRound(0, this.channel.capacity, this.left.funding_balance * this.channel.funding_ratio);
        this.maxStartingBalance = clampRound(0, this.channel.capacity, this.channel.capacity - (this.right.funding_balance * this.channel.funding_ratio));
      }

      closingCapacity = this.channel.capacity - this.channel.closing_fee;
      this.minClosingBalance = clampRound(0, closingCapacity, this.left.closing_balance);
      this.maxClosingBalance = clampRound(0, closingCapacity, closingCapacity - this.right.closing_balance);

      // margin of error to account for 2 x 330 sat anchor outputs
      if (Math.abs(this.minClosingBalance - this.maxClosingBalance) <= 660) {
        this.maxClosingBalance = this.minClosingBalance;
      }
    } else {
      this.showStartingBalance = false;
      this.showClosingBalance = false;
    }

    const startingMinPc = (this.minStartingBalance / this.channel.capacity) * 100;
    const startingMaxPc = (this.maxStartingBalance / this.channel.capacity) * 100;
    this.startingBalanceStyle = {
      left: `left: 0%; right: ${100 - startingMinPc}%;`,
      center: `left: ${startingMinPc}%; right: ${100 -startingMaxPc}%;`,
      right: `left: ${startingMaxPc}%; right: 0%;`,
    };
    this.hideStartingLeft = startingMinPc < 15;
    this.hideStartingRight = startingMaxPc > 85;

    const closingMinPc = (this.minClosingBalance / closingCapacity) * 100;
    const closingMaxPc = (this.maxClosingBalance / closingCapacity) * 100;
    this.closingBalanceStyle = {
      left: `left: 0%; right: ${100 - closingMinPc}%;`,
      center: `left: ${closingMinPc}%; right: ${100 - closingMaxPc}%;`,
      right: `left: ${closingMaxPc}%; right: 0%;`,
    };
    this.hideClosingLeft = closingMinPc < 15;
    this.hideClosingRight = closingMaxPc > 85;
  }
}

function clampRound(min: number, max: number, value: number): number {
  return Math.max(0, Math.min(max, Math.round(value)));
}
