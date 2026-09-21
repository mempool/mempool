import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnInit,
} from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  AddressTypeInfo,
  TX_OVERHEAD_VSIZE,
  TYPICAL_OUTPUT_VSIZE,
  estimateInputVsize,
} from '@app/shared/address-utils';

interface CostToSpend {
  feeRate: number;
  inputVsize: number;
  estimated: boolean;
  minCost: number;
  maxCost: number;
  minFeePercent: number;
  maxFeePercent: number;
  minFeeColor: string;
  maxFeeColor: string;
  minEffectiveBalance: number;
  maxEffectiveBalance: number;
}

@Component({
  selector: 'app-cost-to-spend',
  templateUrl: './cost-to-spend.component.html',
  styleUrls: ['./cost-to-spend.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CostToSpendComponent implements OnInit, OnChanges {
  @Input() addressTypeInfo: AddressTypeInfo;
  @Input() utxoCount: number;
  @Input() balance: number;
  @Input() feeRate: number;

  costToSpend$: Observable<CostToSpend>;
  // Bridges @Input changes (balance, feerate from the slider) into the reactive pipeline so cost recalculates live
  private inputs$ = new BehaviorSubject<void>(undefined);

  ngOnInit(): void {
    this.costToSpend$ = this.inputs$.pipe(
      map(() => this.calculate(this.feeRate)),
    );
  }

  ngOnChanges(): void {
    this.inputs$.next();
  }

  // fee-share thresholds (% of balance) at which spending reads as costly / uneconomical
  private readonly FEE_PERCENT_COSTLY = 10;
  private readonly FEE_PERCENT_UNECONOMICAL = 100;

  private feeColor(percent: number): string {
    if (percent >= this.FEE_PERCENT_UNECONOMICAL) {
      return 'var(--red)';
    }
    if (percent >= this.FEE_PERCENT_COSTLY) {
      return 'var(--orange)';
    }
    return 'var(--green)';
  }

  private calculate(feeRate: number): CostToSpend {
    const { vsize: inputVsize, estimated } = estimateInputVsize(
      this.addressTypeInfo,
      this.addressTypeInfo.observedInputVsize
    );
    const overhead = TX_OVERHEAD_VSIZE + TYPICAL_OUTPUT_VSIZE;
    // consolidate all UTXOs into one tx overhead paid once (theoretical lower bound)
    const minCost = Math.ceil(
      (this.utxoCount * inputVsize + overhead) * feeRate
    );
    // max spend each UTXO in its own transaction, rounding each individual
    const maxCost =
      this.utxoCount * Math.ceil((inputVsize + overhead) * feeRate);
    // share of the balance eaten by fees; can exceed 100% when fees outweigh a dusty balance
    const minFeePercent = this.balance > 0 ? (minCost / this.balance) * 100 : 0;
    const maxFeePercent = this.balance > 0 ? (maxCost / this.balance) * 100 : 0;
    return {
      feeRate,
      inputVsize,
      estimated,
      minCost,
      maxCost,
      minFeePercent,
      maxFeePercent,
      minFeeColor: this.feeColor(minFeePercent),
      maxFeeColor: this.feeColor(maxFeePercent),
      // min effective balance subtracts the max cost & max subtracts the min
      minEffectiveBalance: Math.max(0, this.balance - maxCost),
      maxEffectiveBalance: Math.max(0, this.balance - minCost),
    };
  }
}
