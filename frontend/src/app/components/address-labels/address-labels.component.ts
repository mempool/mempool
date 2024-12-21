import { Component, ChangeDetectionStrategy, Input, OnChanges } from '@angular/core';
import { Vin, Vout } from '@interfaces/electrs.interface';
import { StateService } from '@app/services/state.service';
import { AddressType, AddressTypeInfo } from '@app/shared/address-utils';

@Component({
  selector: 'app-address-labels',
  templateUrl: './address-labels.component.html',
  styleUrls: ['./address-labels.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressLabelsComponent implements OnChanges {
  network = '';

  @Input() address: AddressTypeInfo;
  @Input() vin: Vin;
  @Input() vout: Vout;
  @Input() channel: any;
  @Input() class: string = '';

  label?: string;

  constructor(
    stateService: StateService,
  ) {
    this.network = stateService.network;
  }

  ngOnChanges() {
    if (this.channel) {
      this.handleChannel();
    } else if (this.address) {
      this.handleAddress();
    } else if (this.vin) {
      this.handleVin();
    } else if (this.vout) {
      this.handleVout();
    }
  }

  handleChannel() {
    const type = this.vout ? 'open' : 'close';
    const leftNodeName = this.channel.node_left.alias || this.channel.node_left.public_key.substring(0, 10);
    const rightNodeName = this.channel.node_right.alias || this.channel.node_right.public_key.substring(0, 10);
    this.label = `Channel ${type}: ${leftNodeName} <> ${rightNodeName}`;
  }

  handleAddress() {
    if (this.address?.scripts.size) {
      const script = this.address?.scripts.values().next().value;
      if (script.template?.label) {
        this.label = script.template.label;
      }
    }
  }

  handleVin() {
    const address = new AddressTypeInfo(this.network || 'mainnet', this.vin.prevout?.scriptpubkey_address, this.vin.prevout?.scriptpubkey_type as AddressType, [this.vin]);
    if (address?.scripts.size) {
      const script = address?.scripts.values().next().value;
      if (script.template?.label) {
        this.label = script.template.label;
      }
    }
  }

  handleVout() {
    const address = new AddressTypeInfo(this.network || 'mainnet', this.vout.scriptpubkey_address, this.vout.scriptpubkey_type as AddressType, undefined, this.vout);
    if (address?.scripts.size) {
      const script = address?.scripts.values().next().value;
      if (script.template?.label) {
        this.label = script.template.label;
      }
    }
  }
}
