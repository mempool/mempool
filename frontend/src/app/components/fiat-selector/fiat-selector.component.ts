import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { fiatCurrencies } from '../../app.constants';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-fiat-selector',
  templateUrl: './fiat-selector.component.html',
  styleUrls: ['./fiat-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FiatSelectorComponent implements OnInit {
  fiatForm: UntypedFormGroup;
  currencies = Object.entries(fiatCurrencies).sort((a: any, b: any) => {
    if (a[1].name < b[1].name) {
      return -1;
    }
    if (a[1].name > b[1].name) {
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
  }

  changeFiat() {
    const newFiat = this.fiatForm.get('fiat')?.value;
    this.storageService.setValue('fiat-preference', newFiat);
    this.stateService.fiatCurrency$.next(newFiat);
  }
}
