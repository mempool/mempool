import { Component, Input, OnInit, OnChanges, HostListener } from '@angular/core';
import { ETA } from '@app/services/eta.service';
import { Transaction } from '@interfaces/electrs.interface';
import { Acceleration, SinglePoolStats } from '@interfaces/node-api.interface';
import { MiningService } from '@app/services/mining.service';

@Component({
  selector: 'app-acceleration-timeline',
  templateUrl: './acceleration-timeline.component.html',
  styleUrls: ['./acceleration-timeline.component.scss'],
})
export class AccelerationTimelineComponent implements OnInit, OnChanges {
  @Input() transactionTime: number;
  @Input() acceleratedAt: number;
  @Input() tx: Transaction;
  @Input() accelerationInfo: Acceleration;
  @Input() eta: ETA;
  @Input() canceled: boolean;

  now: number;
  accelerateRatio: number;
  useAbsoluteTime: boolean = false;
  firstSeenToAccelerated: number;
  acceleratedToMined: number;

  tooltipPosition = null;
  hoverInfo: any = null;
  poolsData: { [id: number]: SinglePoolStats } = {};

  constructor(
    private miningService: MiningService,
  ) {}

  ngOnInit(): void {
    this.updateTimes();

    this.miningService.getPools().subscribe(pools => {
      for (const pool of pools) {
        this.poolsData[pool.unique_id] = pool;
      }
    });
  }

  ngOnChanges(changes): void {
    this.updateTimes();
  }

  updateTimes(): void {
    this.now = Math.floor(new Date().getTime() / 1000);
    this.useAbsoluteTime = this.tx.status.block_time < this.now - 7 * 24 * 3600;
    this.firstSeenToAccelerated = Math.max(0, this.acceleratedAt - this.transactionTime);
    this.acceleratedToMined = Math.max(0, this.tx.status.block_time - this.acceleratedAt);
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
