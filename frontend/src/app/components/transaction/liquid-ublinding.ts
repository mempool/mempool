import { Transaction } from '@interfaces/electrs.interface';

  // Parse the blinders data from a string encoded as a comma separated list, in the following format:
  // <value_in_satoshis>,<asset_tag_hex>,<amount_blinder_hex>,<asset_blinder_hex>
  // This can be repeated with a comma separator to specify blinders for multiple outputs.
export class LiquidUnblinding {
  commitments: Map<any, any>;

  parseBlinders(str: string) {
    const parts = str.split(',');
    const blinders = [];
    while (parts.length) {
      blinders.push({
        value: this.verifyNum(parts.shift()),
        asset: this.verifyHex32(parts.shift()),
        value_blinder: this.verifyHex32(parts.shift()),
        asset_blinder: this.verifyHex32(parts.shift()),
      });
    }
    return blinders;
  }

  verifyNum(num: string) {
    if (!+num) {
      throw new Error('Invalid blinding data (invalid number)');
    }
    return +num;
  }
  verifyHex32(str: string) {
    if (!str || !/^[0-9a-f]{64}$/i.test(str)) {
      throw new Error('Invalid blinding data (invalid hex)');
    }
    return str;
  }

  async makeCommitmentMap(blinders: any) {
    const libwally = await import('@components/transaction/libwally.js');
    await libwally.load();
    const commitments = new Map();
    blinders.forEach(b => {
      const { asset_commitment, value_commitment } =
      libwally.generate_commitments(b.value, b.asset, b.value_blinder, b.asset_blinder);

      commitments.set(`${asset_commitment}:${value_commitment}`, {
        asset: b.asset,
        value: b.value,
      });
    });
    return commitments;
  }

  // Look for the given output, returning an { value, asset } object
  find(vout: any) {
    return vout.assetcommitment && vout.valuecommitment &&
      this.commitments.get(`${vout.assetcommitment}:${vout.valuecommitment}`);
  }

  // Lookup all transaction inputs/outputs and attach the unblinded data
  tryUnblindTx(tx: Transaction) {
    if (tx) {
      if (tx._unblinded) { return tx; }
      let matched = 0;
      if (tx.vout !== undefined) {
        tx.vout.forEach(vout => matched += +this.tryUnblindOut(vout));
        tx.vin.filter(vin => vin.prevout).forEach(vin => matched += +this.tryUnblindOut(vin.prevout));
      }
      if (this.commitments !== undefined) {
        tx._unblinded = { matched, total: this.commitments.size };
        this.deduceBlinded(tx);
        if (matched < this.commitments.size) {
          throw new Error(`Invalid blinding data.`)
        }
        tx._deduced = false; // invalidate cache so deduction is attempted again
        return tx;
      }
    }
  }

  // Look the given output and attach the unblinded data
  tryUnblindOut(vout: any) {
    const unblinded = this.find(vout);
    if (unblinded) { Object.assign(vout, unblinded); }
    return !!unblinded;
  }

  // Attempt to deduce the blinded input/output based on the available information
  deduceBlinded(tx: any) {
    if (tx._deduced) { return; }
    tx._deduced = true;

    // Find ins/outs with unknown amounts (blinded ant not revealed via the `#blinded` hash fragment)
    const unknownIns = tx.vin.filter(vin => vin.prevout && vin.prevout.value == null);
    const unknownOuts = tx.vout.filter(vout => vout.value == null);

    // If the transaction has a single unknown input/output, we can deduce its asset/amount
    // based on the other known inputs/outputs.
    if (unknownIns.length + unknownOuts.length === 1) {

      // Keep a per-asset tally of all known input amounts, minus all known output amounts
      const totals = new Map();
      tx.vin.filter(vin => vin.prevout && vin.prevout.value != null)
        .forEach(({ prevout }) =>
          totals.set(prevout.asset, (totals.get(prevout.asset) || 0) + prevout.value));
      tx.vout.filter(vout => vout.value != null)
        .forEach(vout =>
          totals.set(vout.asset, (totals.get(vout.asset) || 0) - vout.value));

      // There should only be a single asset where the inputs and outputs amounts mismatch,
      // which is the asset of the blinded input/output
      const remainder = Array.from(totals.entries()).filter(([ asset, value ]) => value !== 0);
      if (remainder.length !== 1) { throw new Error('unexpected remainder while deducing blinded tx'); }
      const [ blindedAsset, blindedValue ] = remainder[0];

      // A positive remainder (when known in > known out) is the asset/amount of the unknown blinded output,
      // a negative one is the input.
      if (blindedValue > 0) {
        if (!unknownOuts.length) { throw new Error('expected unknown output'); }
        unknownOuts[0].asset = blindedAsset;
        unknownOuts[0].value = blindedValue;
      } else {
        if (!unknownIns.length) { throw new Error('expected unknown input'); }
        unknownIns[0].prevout.asset = blindedAsset;
        unknownIns[0].prevout.value = blindedValue * -1;
      }
    }
  }

  async checkUnblindedTx(tx: Transaction) {
    if (!window.location.hash?.length) {
      return tx;
    }
    const fragmentParams = new URLSearchParams(window.location.hash.slice(1) || '');
    const blinderStr = fragmentParams.get('blinded');
    if (blinderStr && blinderStr.length) {
      const blinders = this.parseBlinders(blinderStr);
      if (blinders) {
        this.commitments = await this.makeCommitmentMap(blinders);
        return this.tryUnblindTx(tx);
      }
    }
    return tx;
  }
}
