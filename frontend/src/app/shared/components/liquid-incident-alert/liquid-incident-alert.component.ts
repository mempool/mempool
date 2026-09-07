import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StorageService } from '@app/services/storage.service';

@Component({
  selector: 'app-liquid-incident-alert',
  templateUrl: './liquid-incident-alert.component.html',
  styleUrls: ['./liquid-incident-alert.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiquidIncidentAlertComponent {

  constructor(public storageService: StorageService) { }

  dismissWarning(): void {
    this.storageService.setValue('hideLiquidIncidentWarning', 'hidden');
  }
}
