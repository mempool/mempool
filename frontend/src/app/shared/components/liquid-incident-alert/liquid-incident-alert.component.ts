import { ChangeDetectionStrategy, Component } from '@angular/core';
import { map } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { StorageService } from '@app/services/storage.service';

@Component({
  selector: 'app-liquid-incident-alert',
  templateUrl: './liquid-incident-alert.component.html',
  styleUrls: ['./liquid-incident-alert.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiquidIncidentAlertComponent {
  showWarning$ = this.stateService.chainTip$.pipe(map(height => height >= 0 && height <= 4050335));

  constructor(public storageService: StorageService, private stateService: StateService) { }

  dismissWarning(): void {
    this.storageService.setValue('hideLiquidIncidentWarning', 'hidden');
  }
}
