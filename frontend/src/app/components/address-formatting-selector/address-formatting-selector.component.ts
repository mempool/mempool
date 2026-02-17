import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { AddressFormattingService } from '@app/services/address-formatting.service';

@Component({
  selector: 'app-address-formatting-selector',
  templateUrl: './address-formatting-selector.component.html',
  styles: [],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddressFormattingSelectorComponent implements OnInit {
  form: UntypedFormGroup;
  
  modes = ['off', 'color', 'spacing', 'copy']; 

  constructor(
    private formBuilder: UntypedFormBuilder,
    private formattingService: AddressFormattingService
  ) {}

  ngOnInit(): void {
    this.form = this.formBuilder.group({
      mode: ['off']
    });

    this.formattingService.mode$.subscribe((mode) => {
      this.form.get('mode')?.setValue(mode, { emitEvent: false });
    });
  }

  changeMode(): void {
    const newMode = this.form.get('mode')?.value;
    this.formattingService.setMode(newMode);
  }
}