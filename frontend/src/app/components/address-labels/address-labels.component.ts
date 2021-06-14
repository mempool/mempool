import { Component, OnInit, ChangeDetectionStrategy, Input } from '@angular/core';
import { Vin, Vout } from '../../interfaces/electrs.interface';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-address-labels',
  templateUrl: './address-labels.component.html',
  styleUrls: ['./address-labels.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressLabelsComponent implements OnInit {
  network = '';

  @Input() vin: Vin;
  @Input() vout: Vout;

  multisig = false;
  multisigM: number;
  multisigN: number;

  lightning = null;
  liquid = null;

  constructor(stateService: StateService) {
    this.network = stateService.network;
  }

  ngOnInit() {
    if (this.vin) {
      this.handleVin();
    } else if (this.vout) {
      this.handleVout();
    }
  }

  handleVin() {
    if (this.vin.inner_witnessscript_asm) {
      if (this.vin.inner_witnessscript_asm.indexOf('OP_DEPTH OP_PUSHNUM_12 OP_EQUAL OP_IF OP_PUSHNUM_11') === 0) {
        if (this.vin.witness.length > 11) {
          this.liquid = 'Peg Out';
        } else {
          this.liquid = 'Emergency Peg Out';
        }
        return;
      }

      [
        // {regexp: /^OP_DUP OP_HASH160/, label: 'HTLC'},
        { regexp: /^OP_IF OP_PUSHBYTES_33 \w{33} OP_ELSE OP_PUSHBYTES_2 \w{2} OP_CSV OP_DROP/, label: 'Force Close' },
      ].forEach(item => {
        if (item.regexp.test(this.vin.inner_witnessscript_asm)) {
          this.lightning = item.label;
        }
      });

      if (this.lightning) {
        return;
      }

      if (this.vin.inner_witnessscript_asm.indexOf('OP_CHECKMULTISIG') > -1) {
        const matches = this.getMatches(this.vin.inner_witnessscript_asm, /OP_PUSHNUM_([0-9])/g, 1);
        this.multisig = true;
        this.multisigM = parseInt(matches[0], 10);
        this.multisigN = parseInt(matches[1], 10);

        if (this.multisigM === 1 && this.multisigN === 1) {
          this.multisig = false;
        }
      }
    }

    if (this.vin.inner_redeemscript_asm && this.vin.inner_redeemscript_asm.indexOf('OP_CHECKMULTISIG') > -1) {
      const matches = this.getMatches(this.vin.inner_redeemscript_asm, /OP_PUSHNUM_([0-9])/g, 1);
      this.multisig = true;
      this.multisigM = matches[0];
      this.multisigN = matches[1];
    }
  }

  handleVout() {}

  getMatches(str: string, regex: RegExp, index: number) {
    if (!index) {
      index = 1;
    }
    const matches = [];
    let match;
    while ((match = regex.exec(str))) {
      matches.push(match[index]);
    }
    return matches;
  }
}
