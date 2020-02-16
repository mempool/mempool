import { Component, OnInit, ChangeDetectionStrategy, Input } from '@angular/core';
import { Vin, Vout } from '../../interfaces/electrs.interface';

@Component({
  selector: 'app-address-labels',
  templateUrl: './address-labels.component.html',
  styleUrls: ['./address-labels.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressLabelsComponent implements OnInit {

  @Input() vin: Vin;
  @Input() vout: Vout;

  multisig = false;
  multisigM: number;
  multisigN: number;

  constructor() { }

  ngOnInit() {
    if (this.vin) {
      this.handleVin();
    } else if (this.vout) {
      this.handleVout();
    }
  }

  handleVin() {
    if (this.vin.inner_witnessscript_asm && this.vin.inner_witnessscript_asm.indexOf('OP_CHECKMULTISIG') > -1) {
      const matches = this.getMatches(this.vin.inner_witnessscript_asm, /OP_PUSHNUM_([0-9])/g, 1);
      this.multisig = true;
      this.multisigM = matches[0];
      this.multisigN = matches[1];
    }

    if (this.vin.inner_redeemscript_asm && this.vin.inner_redeemscript_asm.indexOf('OP_CHECKMULTISIG') > -1) {
      const matches = this.getMatches(this.vin.inner_redeemscript_asm, /OP_PUSHNUM_([0-9])/g, 1);
      this.multisig = true;
      this.multisigM = matches[0];
      this.multisigN = matches[1];
    }
  }

  handleVout() {
  }

  getMatches(str: string, regex: RegExp, index: number) {
    if (!index) {
      index = 1;
    }
    const matches = [];
    let match;
    while (match = regex.exec(str)) {
      matches.push(match[index]);
    }
    return matches;
  }

}
