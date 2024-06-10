import { Component, Input } from '@angular/core';
import { Vout } from '../../../interfaces/electrs.interface';

@Component({
  selector: 'app-address-type',
  templateUrl: './address-type.component.html',
  styleUrls: []
})
export class AddressTypeComponent {
  @Input() vout: Vout;
}
