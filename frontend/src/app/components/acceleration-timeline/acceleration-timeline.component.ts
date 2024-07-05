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

  acceleratedAt: number;

  constructor() {}

  ngOnInit(): void {
    this.acceleratedAt = this.tx.acceleratedAt ?? new Date().getTime() / 1000;
  }

  ngOnChanges(changes): void {
  }

}
