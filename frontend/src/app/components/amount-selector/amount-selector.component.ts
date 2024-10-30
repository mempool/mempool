import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { StorageService } from '@app/services/storage.service';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-amount-selector',
  templateUrl: './amount-selector.component.html',
  styleUrls: ['./amount-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AmountSelectorComponent implements OnInit {
  amountForm: UntypedFormGroup;
  modes = ['btc', 'sats', 'fiat'];

  constructor(
    private formBuilder: UntypedFormBuilder,
    private stateService: StateService,
    private storageService: StorageService,
  ) { }

  ngOnInit() {
    this.amountForm = this.formBuilder.group({
      mode: ['btc']
    });
    this.stateService.viewAmountMode$.subscribe((mode) => {
      this.amountForm.get('mode')?.setValue(mode);
    });
  }

  changeMode() {
    const newMode = this.amountForm.get('mode')?.value;
    this.storageService.setValue('view-amount-mode', newMode);
    this.stateService.viewAmountMode$.next(newMode);
  }
}
