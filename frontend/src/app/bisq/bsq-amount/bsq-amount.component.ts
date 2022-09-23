import { Component, OnInit, ChangeDetectionStrategy, Input } from '@angular/core';
import { StateService } from '../../services/state.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-bsq-amount',
  templateUrl: './bsq-amount.component.html',
  styleUrls: ['./bsq-amount.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BsqAmountComponent implements OnInit {
  conversions$: Observable<any>;
  viewFiat$: Observable<boolean>;
  bsqPrice$: Observable<number>;

  @Input() bsq: number;
  @Input() digitsInfo = '1.2-2';
  @Input() forceFiat = false;
  @Input() green = false;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.viewFiat$ = this.stateService.viewFiat$.asObservable();
    this.conversions$ = this.stateService.conversions$.asObservable();
    this.bsqPrice$ = this.stateService.bsqPrice$;
  }
}
