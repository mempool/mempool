import { Component, Input } from '@angular/core';
import { AddressTypeInfo } from '@app/shared/address-utils';

@Component({
  selector: 'app-address-type',
  templateUrl: './address-type.component.html',
  styleUrls: []
})
export class AddressTypeComponent {
  @Input() address: AddressTypeInfo;
}
