import { Component, Input } from '@angular/core';
import { AddressTypeInfo } from '../../address-utils';

@Component({
  selector: 'app-address-type',
  templateUrl: './address-type.component.html',
  styleUrls: []
})
export class AddressTypeComponent {
  @Input() address: AddressTypeInfo;
}
