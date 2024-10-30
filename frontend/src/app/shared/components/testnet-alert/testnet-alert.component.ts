import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StorageService } from '@app/services/storage.service';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-testnet-alert',
  templateUrl: './testnet-alert.component.html',
  styleUrls: ['./testnet-alert.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestnetAlertComponent {

  constructor(
    public storageService: StorageService,
    public stateService: StateService,
  ) { }

  dismissWarning(): void {
    this.storageService.setValue('hideWarning', 'hidden');
  }

}
