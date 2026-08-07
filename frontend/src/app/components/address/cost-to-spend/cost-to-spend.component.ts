import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnInit,
} from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, of } from 'rxjs';
import { map, timeout, catchError, startWith } from 'rxjs/operators';
import { StateService } from '@app/services/state.service';
import {
  AddressTypeInfo,
  TX_OVERHEAD_VSIZE,
  TYPICAL_OUTPUT_VSIZE,
  estimateInputVsize,
} from '@app/shared/address-utils';

// give up waiting for fees over the websocket after this long
const FEE_TIMEOUT_MS = 10000;

interface CostToSpend {
  feeRate: number;
  inputVsize: number;
  estimated: boolean;
  minCost: number;
  maxCost: number;
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

  costToSpend$: Observable<CostToSpend | null | undefined>;
  // Bridges @Input changes into the reactive pipeline so cost recalculates on live balance updates
  private inputs$ = new BehaviorSubject<void>(undefined);

  constructor(private stateService: StateService) {}

  ngOnInit(): void {
    this.costToSpend$ = combineLatest([
      this.stateService.recommendedFees$,
      this.inputs$,
    ]).pipe(
      map(([fees]) => this.calculate(fees.halfHourFee)),
      timeout({ first: FEE_TIMEOUT_MS }), // fees never arrived (websocket failure)
      catchError(() => of(null)), // null = unavailable; stream closes, but *ngIf recreates the component on navigation so the state can't persist across addresses
      startWith(undefined),
    );
  }

  ngOnChanges(): void {
    this.inputs$.next();
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
    return {
      feeRate,
      inputVsize,
      estimated,
      minCost,
      maxCost,
      // min effective balance subtracts the max cost & max subtracts the min
      minEffectiveBalance: Math.max(0, this.balance - maxCost),
      maxEffectiveBalance: Math.max(0, this.balance - minCost),
    };
  }
}
