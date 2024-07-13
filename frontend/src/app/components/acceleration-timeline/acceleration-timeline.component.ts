import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { ETA } from '../../services/eta.service';
import { Transaction } from '../../interfaces/electrs.interface';

@Component({
  selector: 'app-acceleration-timeline',
  templateUrl: './acceleration-timeline.component.html',
  styleUrls: ['./acceleration-timeline.component.scss'],
})
export class AccelerationTimelineComponent implements OnInit, OnChanges {
  @Input() transactionTime: number;
  @Input() tx: Transaction;
  @Input() eta: ETA;
  // A mined transaction has standard ETA and accelerated ETA undefined
  // A transaction in mempool has either standardETA defined (if accelerated) or acceleratedETA defined (if not accelerated yet)
  @Input() standardETA: number;
  @Input() acceleratedETA: number;

  acceleratedAt: number;
  now: number;
  accelerateRatio: number;
  useAbsoluteTime: boolean = false;
  interval: number;

  constructor() {}

  ngOnInit(): void {
    this.acceleratedAt = this.tx.acceleratedAt ?? new Date().getTime() / 1000;
    this.now = Math.floor(new Date().getTime() / 1000);
    this.useAbsoluteTime = this.tx.status.block_time < this.now - 7 * 24 * 3600;

    this.interval = window.setInterval(() => {
      this.now = Math.floor(new Date().getTime() / 1000);
      this.useAbsoluteTime = this.tx.status.block_time < this.now - 7 * 24 * 3600;
    }, 60000);
  }

  ngOnChanges(changes): void {
    // Hide standard ETA while we don't have a proper standard ETA calculation, see https://github.com/mempool/mempool/issues/65
    
    // if (changes?.eta?.currentValue || changes?.standardETA?.currentValue || changes?.acceleratedETA?.currentValue) {
    //   if (changes?.eta?.currentValue) {
    //     if (changes?.acceleratedETA?.currentValue) {
    //       this.accelerateRatio = Math.floor((Math.floor(changes.eta.currentValue.time / 1000) - this.now) / (Math.floor(changes.acceleratedETA.currentValue / 1000) - this.now));
    //     } else if (changes?.standardETA?.currentValue) {
    //       this.accelerateRatio = Math.floor((Math.floor(changes.standardETA.currentValue / 1000) - this.now) / (Math.floor(changes.eta.currentValue.time / 1000) - this.now));
    //     }
    //   }
    // }
  }

  ngOnDestroy(): void {
    clearInterval(this.interval);
  }
}
