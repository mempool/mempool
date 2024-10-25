import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { StorageService } from '@app/services/storage.service';
import { fiatCurrencies } from '@app/app.constants';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-fiat-selector',
  templateUrl: './fiat-selector.component.html',
  styleUrls: ['./fiat-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FiatSelectorComponent implements OnInit {
  fiatForm: UntypedFormGroup;
  currencies = Object.entries(fiatCurrencies).sort((a: any, b: any) => {
    if (a[1].code < b[1].code) {
      return -1;
    }
    if (a[1].code > b[1].code) {
      return 1;
    }
    return 0;
  });

  constructor(
    private formBuilder: UntypedFormBuilder,
    private stateService: StateService,
    private storageService: StorageService,
  ) { }

  ngOnInit() {
    this.fiatForm = this.formBuilder.group({
      fiat: ['USD']
    });
    this.stateService.fiatCurrency$.subscribe((fiat) => {
      this.fiatForm.get('fiat')?.setValue(fiat);
    });
    if (!this.stateService.env.ADDITIONAL_CURRENCIES) {
      this.currencies = this.currencies.filter((currency: any) => {
        return ['AUD', 'CAD', 'EUR', 'JPY', 'GBP', 'CHF', 'USD'].includes(currency[0]);
      });
    }
  }

  changeFiat() {
    const newFiat = this.fiatForm.get('fiat')?.value;
    this.storageService.setValue('fiat-preference', newFiat);
    this.stateService.fiatCurrency$.next(newFiat);
  }
}
