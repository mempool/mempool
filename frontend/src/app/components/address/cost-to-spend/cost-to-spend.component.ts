import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnInit,
} from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { StateService } from '@app/services/state.service';
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
  worstEffectiveBalance: number;
  bestEffectiveBalance: number;
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

  costToSpend$: Observable<CostToSpend>;
  private inputs$ = new BehaviorSubject<void>(undefined);

  constructor(private stateService: StateService) {}

  ngOnInit(): void {
    this.costToSpend$ = combineLatest([
      this.stateService.recommendedFees$,
      this.inputs$,
    ]).pipe(map(([fees]) => this.calculate(fees.halfHourFee)));
  }

  ngOnChanges(): void {
    this.inputs$.next();
  }

  private calculate(feeRate: number): CostToSpend {
    const { vsize: inputVsize, estimated } = estimateInputVsize(
      this.addressTypeInfo
    );
    const overhead = TX_OVERHEAD_VSIZE + TYPICAL_OUTPUT_VSIZE;
    // min: consolidate every UTXO in a single transaction (overhead amortized)
    const minCost = Math.round(this.utxoCount * inputVsize * feeRate);
    // max: spend each UTXO in its own transaction, rounding each individual
    // spend up to whole satoshis before summing
    const maxCost =
      this.utxoCount * Math.ceil((inputVsize + overhead) * feeRate);
    return {
      feeRate,
      inputVsize,
      estimated,
      minCost,
      maxCost,
      worstEffectiveBalance: Math.max(0, this.balance - maxCost),
      bestEffectiveBalance: Math.max(0, this.balance - minCost),
    };
  }
}
