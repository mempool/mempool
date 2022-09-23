import { Component, ChangeDetectionStrategy, Input, OnChanges } from '@angular/core';
import { Vin, Vout } from '../../interfaces/electrs.interface';
import { StateService } from '../../services/state.service';
import { parseMultisigScript } from '../../bitcoin.utils';

@Component({
  selector: 'app-address-labels',
  templateUrl: './address-labels.component.html',
  styleUrls: ['./address-labels.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressLabelsComponent implements OnChanges {
  network = '';

  @Input() vin: Vin;
  @Input() vout: Vout;
  @Input() channel: any;

  label?: string;

  constructor(
    stateService: StateService,
  ) {
    this.network = stateService.network;
  }

  ngOnChanges() {
    if (this.channel) {
      this.handleChannel();
    } else if (this.vin) {
      this.handleVin();
    } else if (this.vout) {
      this.handleVout();
    }
  }

  handleChannel() {
    const type = this.vout ? 'open' : 'close';
    this.label = `Channel ${type}: ${this.channel.node_left.alias} <> ${this.channel.node_right.alias}`;
  }

  handleVin() {
    if (this.vin.inner_witnessscript_asm) {
      if (this.vin.inner_witnessscript_asm.indexOf('OP_DEPTH OP_PUSHNUM_12 OP_EQUAL OP_IF OP_PUSHNUM_11') === 0) {
        if (this.vin.witness.length > 11) {
          this.label = 'Liquid Peg Out';
        } else {
          this.label = 'Emergency Liquid Peg Out';
        }
        return;
      }

      const topElement = this.vin.witness[this.vin.witness.length - 2];
      if (/^OP_IF OP_PUSHBYTES_33 \w{66} OP_ELSE OP_PUSH(NUM_\d+|BYTES_(1 \w{2}|2 \w{4})) OP_CSV OP_DROP OP_PUSHBYTES_33 \w{66} OP_ENDIF OP_CHECKSIG$/.test(this.vin.inner_witnessscript_asm)) {
        // https://github.com/lightning/bolts/blob/master/03-transactions.md#commitment-transaction-outputs
        if (topElement === '01') {
          // top element is '01' to get in the revocation path
          this.label = 'Revoked Lightning Force Close';
        } else {
          // top element is '', this is a delayed to_local output
          this.label = 'Lightning Force Close';
        }
        return;
      } else if (
        /^OP_DUP OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUAL OP_IF OP_CHECKSIG OP_ELSE OP_PUSHBYTES_33 \w{66} OP_SWAP OP_SIZE OP_PUSHBYTES_1 20 OP_EQUAL OP_NOTIF OP_DROP OP_PUSHNUM_2 OP_SWAP OP_PUSHBYTES_33 \w{66} OP_PUSHNUM_2 OP_CHECKMULTISIG OP_ELSE OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUALVERIFY OP_CHECKSIG OP_ENDIF (OP_PUSHNUM_1 OP_CSV OP_DROP |)OP_ENDIF$/.test(this.vin.inner_witnessscript_asm) ||
        /^OP_DUP OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUAL OP_IF OP_CHECKSIG OP_ELSE OP_PUSHBYTES_33 \w{66} OP_SWAP OP_SIZE OP_PUSHBYTES_1 20 OP_EQUAL OP_IF OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUALVERIFY OP_PUSHNUM_2 OP_SWAP OP_PUSHBYTES_33 \w{66} OP_PUSHNUM_2 OP_CHECKMULTISIG OP_ELSE OP_DROP OP_PUSHBYTES_3 \w{6} OP_CLTV OP_DROP OP_CHECKSIG OP_ENDIF (OP_PUSHNUM_1 OP_CSV OP_DROP |)OP_ENDIF$/.test(this.vin.inner_witnessscript_asm)
      ) {
        // https://github.com/lightning/bolts/blob/master/03-transactions.md#offered-htlc-outputs
        // https://github.com/lightning/bolts/blob/master/03-transactions.md#received-htlc-outputs
        if (topElement.length === 66) {
          // top element is a public key
          this.label = 'Revoked Lightning HTLC';
        } else if (topElement) {
          // top element is a preimage
          this.label = 'Lightning HTLC';
        } else {
          // top element is '' to get in the expiry of the script
          this.label = 'Expired Lightning HTLC';
        }
        return;
      } else if (/^OP_PUSHBYTES_33 \w{66} OP_CHECKSIG OP_IFDUP OP_NOTIF OP_PUSHNUM_16 OP_CSV OP_ENDIF$/.test(this.vin.inner_witnessscript_asm)) {
        // https://github.com/lightning/bolts/blob/master/03-transactions.md#to_local_anchor-and-to_remote_anchor-output-option_anchors
        if (topElement) {
          // top element is a signature
          this.label = 'Lightning Anchor';
        } else {
          // top element is '', it has been swept after 16 blocks
          this.label = 'Swept Lightning Anchor';
        }
        return;
      }

      this.detectMultisig(this.vin.inner_witnessscript_asm);
    }

    this.detectMultisig(this.vin.inner_redeemscript_asm);

    this.detectMultisig(this.vin.prevout.scriptpubkey_asm);
  }

  detectMultisig(script: string) {
    const ms = parseMultisigScript(script);

    if (ms) {
      this.label = $localize`:@@address-label.multisig:Multisig ${ms.m}:multisigM: of ${ms.n}:multisigN:`;
    }
  }

  handleVout() {
    this.detectMultisig(this.vout.scriptpubkey_asm);
  }
}
