import { Component, OnInit, Input, ChangeDetectionStrategy } from '@angular/core';
import { StateService } from '../../services/state.service';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-amount',
  templateUrl: './amount.component.html',
  styleUrls: ['./amount.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmountComponent implements OnInit {
  conversions$: Observable<any>;
  viewFiat$: Observable<boolean>;
  network = environment.network;

  @Input() satoshis: number;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.viewFiat$ = this.stateService.viewFiat$.asObservable();
    this.conversions$ = this.stateService.conversions$.asObservable();
  }

}
