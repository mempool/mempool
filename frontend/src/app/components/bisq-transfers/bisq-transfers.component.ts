import { Component, OnInit, ChangeDetectionStrategy, Input } from '@angular/core';
import { BisqTransaction } from 'src/app/interfaces/bisq.interfaces';

@Component({
  selector: 'app-bisq-transfers',
  templateUrl: './bisq-transfers.component.html',
  styleUrls: ['./bisq-transfers.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BisqTransfersComponent {
  @Input() tx: BisqTransaction;

  constructor() { }

  trackByIndexFn(index: number) {
    return index;
  }

}
