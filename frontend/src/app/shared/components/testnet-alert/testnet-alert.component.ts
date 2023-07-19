import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StorageService } from '../../../services/storage.service';

@Component({
  selector: 'app-testnet-alert',
  templateUrl: './testnet-alert.component.html',
  styleUrls: ['./testnet-alert.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestnetAlertComponent {

  constructor(
    public storageService: StorageService,
  ) { }

  dismissWarning(): void {
    this.storageService.setValue('hideWarning', 'hidden');
  }

}
