import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { StorageService } from '@app/services/storage.service';
import { StateService } from '@app/services/state.service';
import { timezones } from '@app/app.constants';


@Component({
  selector: 'app-timezone-selector',
  templateUrl: './timezone-selector.component.html',
  styleUrls: ['./timezone-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimezoneSelectorComponent implements OnInit {
  timezoneForm: UntypedFormGroup;
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
    this.stateService.timezone$.subscribe((mode) => {
      this.timezoneForm.get('mode')?.setValue(mode);
    });
  }

  changeMode() {
    const newMode = this.timezoneForm.get('mode')?.value;
    this.storageService.setValue('timezone-preference', newMode);
    this.stateService.timezone$.next(newMode);
  }

  setLocalTimezone() {
    const offset = new Date().getTimezoneOffset();
    const sign = offset <= 0 ? "+" : "-";
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
