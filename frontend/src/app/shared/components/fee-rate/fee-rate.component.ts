import { Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-fee-rate',
  templateUrl: './fee-rate.component.html',
  styleUrls: ['./fee-rate.component.scss']
})
export class FeeRateComponent implements OnInit {
  @Input() fee: number | undefined;
  @Input() weight: number = 4;
  @Input() rounding: string = null;
  @Input() showUnit: boolean = true;
  @Input() unitClass: string = 'symbol';
  @Input() unitStyle: any;

  rateUnits$: Observable<string>;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.rateUnits$ = this.stateService.rateUnits$;
  }
}
