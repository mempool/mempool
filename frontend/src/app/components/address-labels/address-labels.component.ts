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

  constructor(
    stateService: StateService,
  ) {
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

      // https://github.com/lightning/bolts/blob/master/03-transactions.md#commitment-transaction-outputs
      if (/^OP_IF OP_PUSHBYTES_33 \w{66} OP_ELSE OP_PUSHBYTES_(1 \w{2}|2 \w{4}) OP_CSV OP_DROP OP_PUSHBYTES_33 \w{66} OP_ENDIF OP_CHECKSIG$/.test(this.vin.inner_witnessscript_asm)) {
		  if (this.vin.witness[this.vin.witness.length - 2] == '01') {
			  this.lightning = 'Revoked Force Close';
		  } else {
			  this.lightning = 'Force Close';
		  }
      // https://github.com/lightning/bolts/blob/master/03-transactions.md#offered-htlc-outputs
	  } else if (/^OP_DUP OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUAL OP_IF OP_CHECKSIG OP_ELSE OP_PUSHBYTES_33 \w{66} OP_SWAP OP_SIZE OP_PUSHBYTES_1 20 OP_EQUAL OP_NOTIF OP_DROP OP_PUSHNUM_2 OP_SWAP OP_PUSHBYTES_33 \w{66} OP_PUSHNUM_2 OP_CHECKMULTISIG OP_ELSE OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUALVERIFY OP_CHECKSIG OP_ENDIF OP_ENDIF$/) {
		  if (this.vin.witness[this.vin.witness.length - 2].length == 66) {
			  this.lightning = 'Revoked HTLC';
		  } else {
			  this.lightning = 'HTLC';
		  }
	  }

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
