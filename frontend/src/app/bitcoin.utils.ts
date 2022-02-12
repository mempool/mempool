import { Transaction, Vin } from './interfaces/electrs.interface';

const P2SH_P2WPKH_COST = 21 * 4; // the WU cost for the non-witness part of P2SH-P2WPKH
const P2SH_P2WSH_COST  = 35 * 4; // the WU cost for the non-witness part of P2SH-P2WSH

export function calcSegwitFeeGains(tx: Transaction) {
  // calculated in weight units
  let realizedGains = 0;
  let potentialBech32Gains = 0;
  let potentialP2shGains = 0;

  for (const vin of tx.vin) {
    if (!vin.prevout) { continue; }

    const isP2pkh = vin.prevout.scriptpubkey_type === 'p2pkh';
    const isP2sh  = vin.prevout.scriptpubkey_type === 'p2sh';
    const isP2wsh = vin.prevout.scriptpubkey_type === 'v0_p2wsh';
    const isP2wpkh = vin.prevout.scriptpubkey_type === 'v0_p2wpkh';
    const isP2tr  = vin.prevout.scriptpubkey_type === 'v1_p2tr';

    const op = vin.scriptsig ? vin.scriptsig_asm.split(' ')[0] : null;
    const isP2sh2Wpkh = isP2sh && !!vin.witness && op === 'OP_PUSHBYTES_22';
    const isP2sh2Wsh = isP2sh && !!vin.witness && op === 'OP_PUSHBYTES_34';

    switch (true) {
      // Native Segwit - P2WPKH/P2WSH (Bech32)
      case isP2wpkh:
      case isP2wsh:
      case isP2tr:
        // maximal gains: the scriptSig is moved entirely to the witness part
        realizedGains += witnessSize(vin) * 3;
        // XXX P2WSH output creation is more expensive, should we take this into consideration?
        break;

      // Backward compatible Segwit - P2SH-P2WPKH
      case isP2sh2Wpkh:
        // the scriptSig is moved to the witness, but we have extra 21 extra non-witness bytes (48 WU)
        realizedGains += witnessSize(vin) * 3 - P2SH_P2WPKH_COST;
        potentialBech32Gains += P2SH_P2WPKH_COST;
        break;

      // Backward compatible Segwit - P2SH-P2WSH
      case isP2sh2Wsh:
        // the scriptSig is moved to the witness, but we have extra 35 extra non-witness bytes
        realizedGains += witnessSize(vin) * 3 - P2SH_P2WSH_COST;
        potentialBech32Gains += P2SH_P2WSH_COST;
        break;

      // Non-segwit P2PKH/P2SH
      case isP2pkh:
      case isP2sh:
        const fullGains = scriptSigSize(vin) * 3;
        potentialBech32Gains += fullGains;
        potentialP2shGains += fullGains - (isP2pkh ? P2SH_P2WPKH_COST : P2SH_P2WSH_COST);
        break;

    // TODO: should we also consider P2PK and pay-to-bare-script (non-p2sh-wrapped) as upgradable to P2WPKH and P2WSH?
    }
  }

  // returned as percentage of the total tx weight
  return { realizedGains: realizedGains / (tx.weight + realizedGains) // percent of the pre-segwit tx size
         , potentialBech32Gains: potentialBech32Gains / tx.weight
         , potentialP2shGains: potentialP2shGains / tx.weight
         };
}

// https://github.com/shesek/move-decimal-point
export function moveDec(num: number, n: number) {
  let frac, int, neg, ref;
  if (n === 0) {
    return num.toString();
  }
  ref = ('' + num).split('.'), int = ref[0], frac = ref[1];
  int || (int = '0');
  frac || (frac = '0');
  neg = (int[0] === '-' ? '-' : '');
  if (neg) {
    int = int.slice(1);
  }
  if (n > 0) {
    if (n > frac.length) {
      frac += zeros(n - frac.length);
    }
    int += frac.slice(0, n);
    frac = frac.slice(n);
  } else {
    n = n * -1;
    if (n > int.length) {
      int = (zeros(n - int.length)) + int;
    }
    frac = int.slice(n * -1) + frac;
    int = int.slice(0, n * -1);
  }
  while (int[0] === '0') {
    int = int.slice(1);
  }
  while (frac[frac.length - 1] === '0') {
    frac = frac.slice(0, -1);
  }
  return neg + (int || '0') + (frac.length ? '.' + frac : '');
}

function zeros(n) {
  return new Array(n + 1).join('0');
}

// Formats a number for display. Treats the number as a string to avoid rounding errors.
export const formatNumber = (s, precision = null) => {
  let [ whole, dec ] = s.toString().split('.');

  // divide numbers into groups of three separated with a thin space (U+202F, "NARROW NO-BREAK SPACE"),
  // but only when there are more than a total of 5 non-decimal digits.
  if (whole.length >= 5) {
    whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');
  }

  if (precision != null && precision > 0) {
    if (dec == null) {
      dec = '0'.repeat(precision);
    }
    else if (dec.length < precision) {
      dec += '0'.repeat(precision - dec.length);
    }
  }

  return whole + (dec != null ? '.' + dec : '');
};

// Utilities for segwitFeeGains
const witnessSize = (vin: Vin) => vin.witness.reduce((S, w) => S + (w.length / 2), 0);
const scriptSigSize = (vin: Vin) => vin.scriptsig ? vin.scriptsig.length / 2 : 0;
