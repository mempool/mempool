import { Component, OnInit, ChangeDetectionStrategy, Input, Inject, LOCALE_ID } from '@angular/core';
import { Observable } from 'rxjs';
import { StateService } from '../services/state.service';
import { getLocaleCurrencyCode, getLocaleCurrencySymbol } from '@angular/common';

@Component({
  selector: 'app-fiat',
  templateUrl: './fiat.component.html',
  styleUrls: ['./fiat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiatComponent implements OnInit {
  conversions$: Observable<any>;
  currencyCode: string;
  currencySymbol: string;

  @Input() value: number;
  @Input() digitsInfo = '1.2-2';

  constructor(
    private stateService: StateService,
    @Inject(LOCALE_ID) private localeId: string
  ) {
    this.currencyCode = getLocaleCurrencyCode(this.localeId);
    this.currencySymbol = getLocaleCurrencySymbol(this.localeId);
  }

  ngOnInit(): void {
    this.conversions$ = this.stateService.conversions$.asObservable();
  }

}
