import { Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { FeeRoundingPipe } from '@app/shared/pipes/fee-rounding/fee-rounding.pipe';

@Component({
  selector: 'app-fee-rate',
  templateUrl: './fee-rate.component.html',
  styleUrls: ['./fee-rate.component.scss'],
  standalone: false,
})
export class FeeRateComponent implements OnInit {
  @Input() fee: number | undefined;
  @Input() weight: number = 4;
  @Input() rounding: string = null;
  @Input() dp: number = null;
  @Input() softDecimals: boolean = false;
  @Input() showUnit: boolean = true;
  @Input() unitClass: string = 'symbol';
  @Input() unitStyle: any;

  rateUnits$: Observable<string>;

  constructor(
    private stateService: StateService,
    private feeRoundingPipe: FeeRoundingPipe,
  ) { }

  ngOnInit() {
    this.rateUnits$ = this.stateService.rateUnits$;
  }

  getIntegerPart(rate: number): string {
    const formatted = this.feeRoundingPipe.transform(rate, this.rounding, this.dp);
    const decimalIndex = formatted.indexOf('.');
    return decimalIndex === -1 ? formatted : formatted.substring(0, decimalIndex);
  }

  getDecimalPart(rate: number): string {
    const formatted = this.feeRoundingPipe.transform(rate, this.rounding, this.dp);
    const decimalIndex = formatted.indexOf('.');
    return decimalIndex === -1 ? ' ' : formatted.substring(decimalIndex) + ' ';
  }
}
