import { Component, OnInit, Input, ChangeDetectionStrategy, LOCALE_ID, Inject } from '@angular/core';
import { StateService } from '../../services/state.service';
import { Observable } from 'rxjs';
import { getLocaleCurrencyCode, getLocaleCurrencySymbol } from '@angular/common';

@Component({
  selector: 'app-amount',
  templateUrl: './amount.component.html',
  styleUrls: ['./amount.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmountComponent implements OnInit {
  conversions$: Observable<any>;
  viewFiat$: Observable<boolean>;
  network = '';
  currencyCode: string;
  currencySymbol: string;

  @Input() satoshis: number;
  @Input() digitsInfo = '1.8-8';
  @Input() noFiat = false;

  constructor(
    private stateService: StateService,
    @Inject(LOCALE_ID) private localeId: string
  ) {
    this.currencyCode = getLocaleCurrencyCode(this.localeId);
    this.currencySymbol = getLocaleCurrencySymbol(this.localeId);
  }

  ngOnInit() {
    this.viewFiat$ = this.stateService.viewFiat$.asObservable();
    this.conversions$ = this.stateService.conversions$.asObservable();
    this.stateService.networkChanged$.subscribe((network) => this.network = network);
  }

}
