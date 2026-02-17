import { Component, Input } from '@angular/core';
import { AddressMatch, AddressTypeInfo } from '@app/shared/address-utils';
import { AddressFormattingService, FormattingMode } from '@app/services/address-formatting.service';

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
  mode: FormattingMode = "off"

  min = Math.min;

  groupColors: string[] = [
    'var(--primary)',
    'var(--success)',
    'var(--info)',
    'white',
  ];

  constructor(
    public formattingService: AddressFormattingService
  ) {}
}