import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { AddressFormattingService, FormattingMode } from '@app/services/address-formatting.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-address-formatting-selector',
  templateUrl: './address-formatting-selector.component.html',
  styles: [],
  standalone: false,
})
export class AddressFormattingSelectorComponent implements OnInit, OnDestroy {
  form: FormGroup;
  private formattingStateSubscription: Subscription;

  constructor(
    private fb: FormBuilder,
    private formattingService: AddressFormattingService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      mode: [this.formattingService.mode]
    });

    this.formattingStateSubscription = this.form.get('mode').valueChanges.subscribe((mode: FormattingMode) => {
      this.formattingService.setMode(mode);
    });
  }

  ngOnDestroy(): void {
    if (this.formattingStateSubscription) {
      this.formattingStateSubscription.unsubscribe();
    }
  }
}