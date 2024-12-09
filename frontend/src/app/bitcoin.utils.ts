import { Transaction, Vin } from '@interfaces/electrs.interface';
import { Hash } from '@app/shared/sha256';

const P2SH_P2WPKH_COST = 21 * 4; // the WU cost for the non-witness part of P2SH-P2WPKH
const P2SH_P2WSH_COST  = 35 * 4; // the WU cost for the non-witness part of P2SH-P2WSH

export function calcSegwitFeeGains(tx: Transaction) {
  // calculated in weight units
  let realizedSegwitGains = 0;
  let potentialSegwitGains = 0;
  let potentialP2shSegwitGains = 0;
  let potentialTaprootGains = 0;
  let realizedTaprootGains = 0;

  for (const vin of tx.vin) {
    if (!vin.prevout) { continue; }

    const isP2pk         = vin.prevout.scriptpubkey_type === 'p2pk';
    // const isBareMultisig = vin.prevout.scriptpubkey_type === 'multisig'; // type will be unknown, so use the multisig helper from the address labels
    const isBareMultisig = !!parseMultisigScript(vin.prevout.scriptpubkey_asm);
    const isP2pkh        = vin.prevout.scriptpubkey_type === 'p2pkh';
    const isP2sh         = vin.prevout.scriptpubkey_type === 'p2sh';
    const isP2wsh        = vin.prevout.scriptpubkey_type === 'v0_p2wsh';
    const isP2wpkh       = vin.prevout.scriptpubkey_type === 'v0_p2wpkh';
    const isP2tr         = vin.prevout.scriptpubkey_type === 'v1_p2tr';

    const op = vin.scriptsig ? vin.scriptsig_asm.split(' ')[0] : null;
    const isP2shP2Wpkh = isP2sh && !!vin.witness && op === 'OP_PUSHBYTES_22';
    const isP2shP2Wsh  = isP2sh && !!vin.witness && op === 'OP_PUSHBYTES_34';

    switch (true) {
      // Native Segwit - P2WPKH/P2WSH/P2TR
      case isP2wpkh:
      case isP2wsh:
      case isP2tr:
        // maximal gains: the scriptSig is moved entirely to the witness part
        // if taproot is used savings are 42 WU higher because it produces smaller signatures and doesn't require a pubkey in the witness
        // this number is explained above `realizedTaprootGains += 42;`
        realizedSegwitGains += (witnessSize(vin) + (isP2tr ? 42 : 0)) * 3;
        // XXX P2WSH output creation is more expensive, should we take this into consideration?
        break;

      // Backward compatible Segwit - P2SH-P2WPKH
      case isP2shP2Wpkh:
        // the scriptSig is moved to the witness, but we have extra 21 extra non-witness bytes (84 WU)
        realizedSegwitGains += witnessSize(vin) * 3 - P2SH_P2WPKH_COST;
        potentialSegwitGains += P2SH_P2WPKH_COST;
        break;

      // Backward compatible Segwit - P2SH-P2WSH
      case isP2shP2Wsh:
        // the scriptSig is moved to the witness, but we have extra 35 extra non-witness bytes (140 WU)
        realizedSegwitGains += witnessSize(vin) * 3 - P2SH_P2WSH_COST;
        potentialSegwitGains += P2SH_P2WSH_COST;
        break;

      // Non-segwit P2PKH/P2SH/P2PK/bare multisig
      case isP2pkh:
      case isP2sh:
      case isP2pk:
      case isBareMultisig: {
        let fullGains = scriptSigSize(vin) * 3;
        if (isBareMultisig) {
          // a _bare_ multisig has the keys in the output script, but P2SH and P2WSH require them to be in the scriptSig/scriptWitness
          fullGains -= vin.prevout.scriptpubkey.length / 2;
        }
        potentialSegwitGains += fullGains;
        potentialP2shSegwitGains += fullGains - (isP2pkh ? P2SH_P2WPKH_COST : P2SH_P2WSH_COST);
        break;
      }
    }

    if (isP2tr) {
      // every valid taproot input has at least one witness item, however transactions
      // created before taproot activation don't need to have any witness data
      // (see https://mempool.space/tx/b10c007c60e14f9d087e0291d4d0c7869697c6681d979c6639dbd960792b4d41)
      if (vin.witness?.length) {
        if (vin.witness.length === 1) {
          // key path spend
          // we don't know if this was a multisig or single sig (the goal of taproot :)),
          // so calculate fee savings by comparing to the cheapest single sig input type: P2WPKH and say "saved at least ...%"
          // the witness size of P2WPKH is 1 (stack size) + 1 (size) + 72 (low s signature) + 1 (size) + 33 (pubkey) = 108 WU
          // the witness size of key path P2TR is 1 (stack size) + 1 (size) + 64 (signature) = 66 WU
          realizedTaprootGains += 42;
        } else {
          // script path spend
          // complex scripts with multiple spending paths can often be made around 2x to 3x smaller with the Taproot script tree
          // because only the hash of the alternative spending path has the be in the witness data, not the entire script,
          // but only assumptions can be made because the scripts themselves are unknown (again, the goal of taproot :))
          // TODO maybe add some complex scripts that are specified somewhere, so that size is known, such as lightning scripts
        }
      }
    } else {
      const script = isP2shP2Wsh || isP2wsh ? vin.inner_witnessscript_asm : vin.inner_redeemscript_asm;
      let replacementSize: number;
      if (
        // single sig
        isP2pk || isP2pkh || isP2wpkh || isP2shP2Wpkh ||
        // multisig
        isBareMultisig || parseMultisigScript(script)
      ) {
        // the scriptSig and scriptWitness can all be replaced by a 66 witness WU with taproot
        replacementSize = 66;
      } else if (script) {
        // not single sig, not multisig: the complex scripts
        // rough calculations on spending paths
        // every OP_IF and OP_NOTIF indicates an _extra_ spending path, so add 1
        const spendingPaths = script.split(' ').filter(op => /^(OP_IF|OP_NOTIF)$/g.test(op)).length + 1;
        // now assume the script could have been split in ${spendingPaths} equal tapleaves
        replacementSize = script.length / 2 / spendingPaths +
        // but account for the leaf and branch hashes and internal key in the control block
          32 * Math.log2((spendingPaths - 1) || 1) + 33;
      }
      potentialTaprootGains += witnessSize(vin) + scriptSigSize(vin) * 4 - replacementSize;
    }
  }

  // returned as percentage of the total tx weight
  return {
    realizedSegwitGains: realizedSegwitGains / (tx.weight + realizedSegwitGains), // percent of the pre-segwit tx size
    potentialSegwitGains: potentialSegwitGains / tx.weight,
    potentialP2shSegwitGains: potentialP2shSegwitGains / tx.weight,
    potentialTaprootGains: potentialTaprootGains / tx.weight,
    realizedTaprootGains: realizedTaprootGains / (tx.weight + realizedTaprootGains)
  };
}

/** extracts m and n from a multisig script (asm), returns nothing if it is not a multisig script */
export function parseMultisigScript(script: string): void | { m: number, n: number } {
  if (!script) {
    return;
  }
  const ops = script.split(' ');
  if (ops.length < 3 || ops.pop() !== 'OP_CHECKMULTISIG') {
    return;
  }
  const opN = ops.pop();
  if (opN !== 'OP_0' && !opN.startsWith('OP_PUSHNUM_')) {
    return;
  }
  const n = parseInt(opN.match(/[0-9]+/)[0], 10);
  if (ops.length < n * 2 + 1) {
    return;
  }
  // pop n public keys
  for (let i = 0; i < n; i++) {
    if (!/^0((2|3)\w{64}|4\w{128})$/.test(ops.pop())) {
      return;
    }
    if (!/^OP_PUSHBYTES_(33|65)$/.test(ops.pop())) {
      return;
    }
  }
  const opM = ops.pop();
  if (opM !== 'OP_0' && !opM.startsWith('OP_PUSHNUM_')) {
    return;
  }
  const m = parseInt(opM.match(/[0-9]+/)[0], 10);

  if (ops.length) {
    return;
  }

  return { m, n };
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

function zeros(n: number) {
  return new Array(n + 1).join('0');
}

// Formats a number for display. Treats the number as a string to avoid rounding errors.
export const formatNumber = (s: number | string, precision: number | null = null) => {
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
const witnessSize = (vin: Vin) => vin.witness ? vin.witness.reduce((S, w) => S + (w.length / 2), 0) : 0;
const scriptSigSize = (vin: Vin) => vin.scriptsig ? vin.scriptsig.length / 2 : 0;

// Power of ten wrapper
export function selectPowerOfTen(val: number, multiplier = 1): { divider: number, unit: string } {
  const powerOfTen = {
    exa: Math.pow(10, 18),
    peta: Math.pow(10, 15),
    tera: Math.pow(10, 12),
    giga: Math.pow(10, 9),
    mega: Math.pow(10, 6),
    kilo: Math.pow(10, 3),
  };

  let selectedPowerOfTen: { divider: number, unit: string };
  if (val < powerOfTen.kilo * multiplier) {
    selectedPowerOfTen = { divider: 1, unit: '' }; // no scaling
  } else if (val < powerOfTen.mega * multiplier) {
    selectedPowerOfTen = { divider: powerOfTen.kilo, unit: 'k' };
  } else if (val < powerOfTen.giga * multiplier) {
    selectedPowerOfTen = { divider: powerOfTen.mega, unit: 'M' };
  } else if (val < powerOfTen.tera * multiplier) {
    selectedPowerOfTen = { divider: powerOfTen.giga, unit: 'G' };
  } else if (val < powerOfTen.peta * multiplier) {
    selectedPowerOfTen = { divider: powerOfTen.tera, unit: 'T' };
  } else if (val < powerOfTen.exa * multiplier) {
    selectedPowerOfTen = { divider: powerOfTen.peta, unit: 'P' };
  } else {
    selectedPowerOfTen = { divider: powerOfTen.exa, unit: 'E' };
  }

  return selectedPowerOfTen;
}

const featureActivation = {
  mainnet: {
    rbf: 399701,
    segwit: 477120,
    taproot: 709632,
  },
  testnet: {
    rbf: 720255,
    segwit: 872730,
    taproot: 2032291,
  },
  testnet4: {
    rbf: 0,
    segwit: 0,
    taproot: 0,
  },
  signet: {
    rbf: 0,
    segwit: 0,
    taproot: 0,
  },
};

export function isFeatureActive(network: string, height: number, feature: 'rbf' | 'segwit' | 'taproot'): boolean {
  const activationHeight = featureActivation[network || 'mainnet']?.[feature];
  if (activationHeight != null) {
    return height >= activationHeight;
  } else {
    return false;
  }
}

export async function calcScriptHash$(script: string): Promise<string> {
  if (!/^[0-9a-fA-F]*$/.test(script) || script.length % 2 !== 0) {
    throw new Error('script is not a valid hex string');
  }
  const buf = Uint8Array.from(script.match(/.{2}/g).map((byte) => parseInt(byte, 16)));
  const hash = new Hash().update(buf).digest();
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray
    .map((bytes) => bytes.toString(16).padStart(2, '0'))
    .join('');
}
