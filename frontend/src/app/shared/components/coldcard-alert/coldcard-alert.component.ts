import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StorageService } from '@app/services/storage.service';


@Component({
  selector: 'app-coldcard-alert',
  templateUrl: 'coldcard-alert.component.html',
  styleUrl: 'coldcard-alert.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class ColdcardAlertComponent {

  constructor(
    public storageService: StorageService
  ) { }

  dismissWarning(): void {
    this.storageService.setValue('hideColdcardWarning', 'hidden');
  }
}