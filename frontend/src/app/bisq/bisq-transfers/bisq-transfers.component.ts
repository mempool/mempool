import { Component, OnInit, ChangeDetectionStrategy, Input, OnChanges } from '@angular/core';
import { BisqTransaction } from '../../bisq/bisq.interfaces';
import { StateService } from '../../services/state.service';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { Block } from '../../interfaces/electrs.interface';

@Component({
  selector: 'app-bisq-transfers',
  templateUrl: './bisq-transfers.component.html',
  styleUrls: ['./bisq-transfers.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BisqTransfersComponent implements OnInit, OnChanges {
  @Input() tx: BisqTransaction;
  @Input() showConfirmations = false;

  totalOutput: number;
  latestBlock$: Observable<Block>;

  constructor(
    private stateService: StateService,
  ) { }

  trackByIndexFn(index: number) {
    return index;
  }

  ngOnInit() {
    this.latestBlock$ = this.stateService.blocks$.pipe(map(([block]) => block));
  }

  ngOnChanges() {
    this.totalOutput = this.tx.outputs.filter((output) => output.isVerified).reduce((acc, output) => acc + output.bsqAmount, 0);
  }

  switchCurrency() {
    const oldvalue = !this.stateService.viewFiat$.value;
    this.stateService.viewFiat$.next(oldvalue);
  }

}
