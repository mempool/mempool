import { Component, Input, OnInit, OnChanges, HostListener } from '@angular/core';
import { ETA } from '../../services/eta.service';
import { Transaction } from '../../interfaces/electrs.interface';
import { Acceleration, SinglePoolStats } from '../../interfaces/node-api.interface';
import { MiningService } from '../../services/mining.service';

@Component({
  selector: 'app-acceleration-timeline',
  templateUrl: './acceleration-timeline.component.html',
  styleUrls: ['./acceleration-timeline.component.scss'],
})
export class AccelerationTimelineComponent implements OnInit, OnChanges {
  @Input() transactionTime: number;
  @Input() tx: Transaction;
  @Input() accelerationInfo: Acceleration;
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
  firstSeenToAccelerated: number;
  acceleratedToMined: number;

  tooltipPosition = null;
  hoverInfo: any = null;
  poolsData: { [id: number]: SinglePoolStats } = {};

  constructor(
    private miningService: MiningService,
  ) {}

  ngOnInit(): void {
    this.acceleratedAt = this.tx.acceleratedAt ?? new Date().getTime() / 1000;

    this.miningService.getPools().subscribe(pools => {
      for (const pool of pools) {
        this.poolsData[pool.unique_id] = pool;
      }
    });
  }

  ngOnChanges(changes): void {
    this.updateTimes();
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

  updateTimes(): void {
    this.now = Math.floor(new Date().getTime() / 1000);
    this.useAbsoluteTime = this.tx.status.block_time < this.now - 7 * 24 * 3600;
    this.firstSeenToAccelerated = Math.max(0, this.acceleratedAt - this.transactionTime);
    this.acceleratedToMined = Math.max(0, this.tx.status.block_time - this.acceleratedAt);
  }

  ngOnDestroy(): void {
    clearInterval(this.interval);
  }
  
  onHover(event, status: string): void {
    if (status === 'seen') {
      this.hoverInfo = {
        status,
        fee: this.tx.fee,
        weight: this.tx.weight
      };
    } else if (status === 'accelerated') {
      this.hoverInfo = {
        status,
        fee: this.accelerationInfo?.effectiveFee || this.tx.fee,
        weight: this.tx.weight,
        feeDelta: this.accelerationInfo?.feeDelta || this.tx.feeDelta,
        pools: this.tx.acceleratedBy || this.accelerationInfo?.pools,
        poolsData: this.poolsData
      };
    } else if (status === 'mined') {
      this.hoverInfo = {
        status,
        fee: this.accelerationInfo?.effectiveFee,
        weight: this.tx.weight,
        bidBoost: this.accelerationInfo?.bidBoost,
        minedByPoolUniqueId: this.accelerationInfo?.minedByPoolUniqueId,
        pools: this.tx.acceleratedBy || this.accelerationInfo?.pools,
        poolsData: this.poolsData
      };
    }
  }

  onBlur(event): void {
    this.hoverInfo = null;
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event) {
    this.tooltipPosition = { x: event.clientX, y: event.clientY };
  }
}
