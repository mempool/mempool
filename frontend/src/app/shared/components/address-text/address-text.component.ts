import { Component, Input, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { AddressMatch, AddressTypeInfo } from '@app/shared/address-utils';
import { AddressFormattingService } from '@app/services/address-formatting.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-address-text',
  templateUrl: './address-text.component.html',
  styleUrls: ['./address-text.component.scss'],
  standalone: false,
})
export class AddressTextComponent {
  @Input() address: string;
  @Input() info: AddressTypeInfo | null;
  @Input() similarity: { score: number, match: AddressMatch, group: number } | null;
  private formattingStateSubscription: Subscription;
  min = Math.min;

  groupColors: string[] = [
    'var(--primary)',
    'var(--success)',
    'var(--info)',
    'white',
  ];

  constructor(
    public formattingService: AddressFormattingService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.formattingStateSubscription = this.formattingService.mode$.subscribe(() => {
      this.cd.markForCheck();
    });
  }

  ngOnDestroy() {
    if (this.formattingStateSubscription) {
      this.formattingStateSubscription.unsubscribe();
    }
  }
}
