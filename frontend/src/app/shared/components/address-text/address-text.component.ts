import { Component, Input } from '@angular/core';
import { AddressMatch, AddressTypeInfo } from '@app/shared/address-utils';

@Component({
    selector: 'app-address-text',
    templateUrl: './address-text.component.html',
    styleUrls: ['./address-text.component.scss'],
    standalone: false
})
export class AddressTextComponent {
  @Input() address: string;
  @Input() info: AddressTypeInfo | null;
  @Input() similarity: { score: number, match: AddressMatch, group: number } | null;

  groupColors: string[] = [
    'var(--primary)',
    'var(--success)',
    'var(--info)',
    'white',
  ];
}
