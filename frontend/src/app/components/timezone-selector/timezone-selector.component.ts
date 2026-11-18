import { ChangeDetectionStrategy, Component, OnInit, OnDestroy } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { StorageService } from '@app/services/storage.service';
import { StateService } from '@app/services/state.service';
import { Subscription } from 'rxjs';
import { timezones } from '@app/app.constants';


@Component({
  selector: 'app-timezone-selector',
  templateUrl: './timezone-selector.component.html',
  styleUrls: ['./timezone-selector.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimezoneSelectorComponent implements OnInit, OnDestroy {
  timezoneForm: UntypedFormGroup;
  timezoneSubscription: Subscription;
  timezones = timezones;
  localTimezoneOffset: string = '';
  localTimezoneName: string;

  constructor(
    private formBuilder: UntypedFormBuilder,
    private stateService: StateService,
    private storageService: StorageService,
  ) { }

  ngOnInit() {
    this.setLocalTimezone();
    this.timezoneForm = this.formBuilder.group({
      mode: ['local'],
    });
    this.timezoneSubscription = this.stateService.timezone$.subscribe((mode) => {
      this.timezoneForm.get('mode')?.setValue(mode);
    });
  }

  changeMode() {
    const newMode = this.timezoneForm.get('mode')?.value;
    this.storageService.setValue('timezone-preference', newMode);
    this.stateService.timezone$.next(newMode);
  }

  ngOnDestroy(): void {
    this.timezoneSubscription.unsubscribe();
  }

  setLocalTimezone() {
    const offset = new Date().getTimezoneOffset();
    const sign = offset <= 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    const hours = String(Math.floor(absOffset / 60));
    const minutes = String(absOffset % 60).padStart(2, '0');
    if (minutes === '00') {
      this.localTimezoneOffset = `${sign}${hours}`;
    } else {
      this.localTimezoneOffset = `${sign}${hours.padStart(2, '0')}:${minutes}`;
    }

    const timezone = this.timezones.find(tz => tz.offset === this.localTimezoneOffset);
    this.timezones = this.timezones.filter(tz => tz.offset !== this.localTimezoneOffset && tz.offset !== '+0');
    this.localTimezoneName = timezone ? timezone.name : '';
  }
}
