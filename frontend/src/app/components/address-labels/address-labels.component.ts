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
      } else if (/^OP_DUP OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUAL OP_IF OP_CHECKSIG OP_ELSE OP_PUSHBYTES_33 \w{66} OP_SWAP OP_SIZE OP_PUSHBYTES_1 20 OP_EQUAL OP_NOTIF OP_DROP OP_PUSHNUM_2 OP_SWAP OP_PUSHBYTES_33 \w{66} OP_PUSHNUM_2 OP_CHECKMULTISIG OP_ELSE OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUALVERIFY OP_CHECKSIG OP_ENDIF (OP_PUSHNUM_1 OP_CHECKSEQUENCEVERIFY OP_DROP |)OP_ENDIF$/.test(this.vin.inner_witnessscript_asm)) {
        if (this.vin.witness[this.vin.witness.length - 2].length == 66) {
            this.lightning = 'Revoked HTLC';
        } else {
            this.lightning = 'HTLC';
        }
      }

      if (this.lightning) {
        return;
      }

      this.detectMultisig(this.vin.inner_witnessscript_asm);
    }

    this.detectMultisig(this.vin.inner_redeemscript_asm);
  }

  detectMultisig(script: string) {
    const ops = script.split(' ');
    if (ops.pop() != 'OP_CHECKMULTISIG') {
      return;
    }
    const opN = ops.pop();
    if (!opN.startsWith('OP_PUSHNUM_')) {
      return;
    }
    const n = parseInt(opN.match(/[0-9]+/)[0]);
    // pop n public keys
    for (var i = 0; i < n; i++) {
      if (ops.pop().length != 66) {
        return;
      }
      if (ops.pop() != 'OP_PUSHBYTES_33') {
        return;
      }
    }
    const opM = ops.pop();
    if (!opM.startsWith('OP_PUSHNUM_')) {
      return;
    }
    const m = parseInt(opN.match(/[0-9]+/)[0]);

    this.multisig = true;
    this.multisigM = m;
    this.multisigN = n;
  }

  handleVout() {
  }
}
