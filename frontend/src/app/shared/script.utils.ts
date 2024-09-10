const opcodes = {
  OP_FALSE: 0,
  OP_0: 0,
  OP_PUSHDATA1: 76,
  OP_PUSHDATA2: 77,
  OP_PUSHDATA4: 78,
  OP_1NEGATE: 79,
  OP_PUSHNUM_NEG1: 79,
  OP_RESERVED: 80,
  OP_TRUE: 81,
  OP_1: 81,
  OP_2: 82,
  OP_3: 83,
  OP_4: 84,
  OP_5: 85,
  OP_6: 86,
  OP_7: 87,
  OP_8: 88,
  OP_9: 89,
  OP_10: 90,
  OP_11: 91,
  OP_12: 92,
  OP_13: 93,
  OP_14: 94,
  OP_15: 95,
  OP_16: 96,
  OP_PUSHNUM_1: 81,
  OP_PUSHNUM_2: 82,
  OP_PUSHNUM_3: 83,
  OP_PUSHNUM_4: 84,
  OP_PUSHNUM_5: 85,
  OP_PUSHNUM_6: 86,
  OP_PUSHNUM_7: 87,
  OP_PUSHNUM_8: 88,
  OP_PUSHNUM_9: 89,
  OP_PUSHNUM_10: 90,
  OP_PUSHNUM_11: 91,
  OP_PUSHNUM_12: 92,
  OP_PUSHNUM_13: 93,
  OP_PUSHNUM_14: 94,
  OP_PUSHNUM_15: 95,
  OP_PUSHNUM_16: 96,
  OP_NOP: 97,
  OP_VER: 98,
  OP_IF: 99,
  OP_NOTIF: 100,
  OP_VERIF: 101,
  OP_VERNOTIF: 102,
  OP_ELSE: 103,
  OP_ENDIF: 104,
  OP_VERIFY: 105,
  OP_RETURN: 106,
  OP_TOALTSTACK: 107,
  OP_FROMALTSTACK: 108,
  OP_2DROP: 109,
  OP_2DUP: 110,
  OP_3DUP: 111,
  OP_2OVER: 112,
  OP_2ROT: 113,
  OP_2SWAP: 114,
  OP_IFDUP: 115,
  OP_DEPTH: 116,
  OP_DROP: 117,
  OP_DUP: 118,
  OP_NIP: 119,
  OP_OVER: 120,
  OP_PICK: 121,
  OP_ROLL: 122,
  OP_ROT: 123,
  OP_SWAP: 124,
  OP_TUCK: 125,
  OP_CAT: 126,
  OP_SUBSTR: 127,
  OP_LEFT: 128,
  OP_RIGHT: 129,
  OP_SIZE: 130,
  OP_INVERT: 131,
  OP_AND: 132,
  OP_OR: 133,
  OP_XOR: 134,
  OP_EQUAL: 135,
  OP_EQUALVERIFY: 136,
  OP_RESERVED1: 137,
  OP_RESERVED2: 138,
  OP_1ADD: 139,
  OP_1SUB: 140,
  OP_2MUL: 141,
  OP_2DIV: 142,
  OP_NEGATE: 143,
  OP_ABS: 144,
  OP_NOT: 145,
  OP_0NOTEQUAL: 146,
  OP_ADD: 147,
  OP_SUB: 148,
  OP_MUL: 149,
  OP_DIV: 150,
  OP_MOD: 151,
  OP_LSHIFT: 152,
  OP_RSHIFT: 153,
  OP_BOOLAND: 154,
  OP_BOOLOR: 155,
  OP_NUMEQUAL: 156,
  OP_NUMEQUALVERIFY: 157,
  OP_NUMNOTEQUAL: 158,
  OP_LESSTHAN: 159,
  OP_GREATERTHAN: 160,
  OP_LESSTHANOREQUAL: 161,
  OP_GREATERTHANOREQUAL: 162,
  OP_MIN: 163,
  OP_MAX: 164,
  OP_WITHIN: 165,
  OP_RIPEMD160: 166,
  OP_SHA1: 167,
  OP_SHA256: 168,
  OP_HASH160: 169,
  OP_HASH256: 170,
  OP_CODESEPARATOR: 171,
  OP_CHECKSIG: 172,
  OP_CHECKSIGVERIFY: 173,
  OP_CHECKMULTISIG: 174,
  OP_CHECKMULTISIGVERIFY: 175,
  OP_NOP1: 176,
  OP_NOP2: 177,
  OP_CHECKLOCKTIMEVERIFY: 177,
  OP_CLTV: 177,
  OP_NOP3: 178,
  OP_CHECKSEQUENCEVERIFY: 178,
  OP_CSV: 178,
  OP_NOP4: 179,
  OP_NOP5: 180,
  OP_NOP6: 181,
  OP_NOP7: 182,
  OP_NOP8: 183,
  OP_NOP9: 184,
  OP_NOP10: 185,
  OP_CHECKSIGADD: 186,
  OP_PUBKEYHASH: 253,
  OP_PUBKEY: 254,
  OP_INVALIDOPCODE: 255,
};
// add unused opcodes
for (let i = 187; i <= 255; i++) {
  opcodes[`OP_RETURN_${i}`] = i;
}

export { opcodes };

export type ScriptType = 'scriptpubkey'
  | 'scriptsig'
  | 'inner_witnessscript'
  | 'inner_redeemscript'

export interface ScriptTemplate {
  type: string;
  label: string;
}

export const ScriptTemplates: { [type: string]: (...args: any) => ScriptTemplate } = {
  liquid_peg_out: () => ({ type: 'liquid_peg_out', label: 'Liquid Peg Out' }),
  liquid_peg_out_emergency: () => ({ type: 'liquid_peg_out_emergency', label: 'Emergency Liquid Peg Out' }),
  ln_force_close: () => ({ type: 'ln_force_close', label: 'Lightning Force Close' }),
  ln_force_close_revoked: () => ({ type: 'ln_force_close_revoked', label: 'Revoked Lightning Force Close' }),
  ln_htlc: () => ({ type: 'ln_htlc', label: 'Lightning HTLC' }),
  ln_htlc_revoked: () => ({ type: 'ln_htlc_revoked', label: 'Revoked Lightning HTLC' }),
  ln_htlc_expired: () => ({ type: 'ln_htlc_expired', label: 'Expired Lightning HTLC' }),
  ln_anchor: () => ({ type: 'ln_anchor', label: 'Lightning Anchor' }),
  ln_anchor_swept: () => ({ type: 'ln_anchor_swept', label: 'Swept Lightning Anchor' }),
  multisig: (m: number, n: number) => ({ type: 'multisig', m, n, label: $localize`:@@address-label.multisig:Multisig ${m}:multisigM: of ${n}:multisigN:` }),
  anchor: () => ({ type: 'anchor', label: 'anchor' }),
};

export class ScriptInfo {
  type: ScriptType;
  scriptPath?: string;
  hex?: string;
  asm?: string;
  template: ScriptTemplate;

  constructor(type: ScriptType, hex?: string, asm?: string, witness?: string[], scriptPath?: string) {
    this.type = type;
    this.hex = hex;
    this.asm = asm;
    if (scriptPath) {
      this.scriptPath = scriptPath;
    }
    if (this.asm) {
      this.template = detectScriptTemplate(this.type, this.asm, witness);
    }
  }

  public clone(): ScriptInfo {
    return { ...this };
  }

  get key(): string {
    return this.type + (this.scriptPath || '');
  }
}

/** parses an inner_witnessscript + witness stack, and detects named script types */
export function detectScriptTemplate(type: ScriptType, script_asm: string, witness?: string[]): ScriptTemplate | undefined {
  if (type === 'inner_witnessscript' && witness?.length) {
    if (script_asm.indexOf('OP_DEPTH OP_PUSHNUM_12 OP_EQUAL OP_IF OP_PUSHNUM_11') === 0 || script_asm.indexOf('OP_PUSHNUM_15 OP_CHECKMULTISIG OP_IFDUP OP_NOTIF OP_PUSHBYTES_2') === 1259) {
      if (witness.length > 11) {
        return ScriptTemplates.liquid_peg_out();
      } else {
        return ScriptTemplates.liquid_peg_out_emergency();
      }
    }

    const topElement = witness[witness.length - 2];
    if (/^OP_IF OP_PUSHBYTES_33 \w{66} OP_ELSE OP_PUSH(NUM_\d+|BYTES_(1 \w{2}|2 \w{4})) OP_CSV OP_DROP OP_PUSHBYTES_33 \w{66} OP_ENDIF OP_CHECKSIG$/.test(script_asm)) {
      // https://github.com/lightning/bolts/blob/master/03-transactions.md#commitment-transaction-outputs
      if (topElement === '01') {
        // top element is '01' to get in the revocation path
        return ScriptTemplates.ln_force_close_revoked();
      } else {
        // top element is '', this is a delayed to_local output
        return ScriptTemplates.ln_force_close();
      }
    } else if (
      /^OP_DUP OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUAL OP_IF OP_CHECKSIG OP_ELSE OP_PUSHBYTES_33 \w{66} OP_SWAP OP_SIZE OP_PUSHBYTES_1 20 OP_EQUAL OP_NOTIF OP_DROP OP_PUSHNUM_2 OP_SWAP OP_PUSHBYTES_33 \w{66} OP_PUSHNUM_2 OP_CHECKMULTISIG OP_ELSE OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUALVERIFY OP_CHECKSIG OP_ENDIF (OP_PUSHNUM_1 OP_CSV OP_DROP |)OP_ENDIF$/.test(script_asm) ||
      /^OP_DUP OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUAL OP_IF OP_CHECKSIG OP_ELSE OP_PUSHBYTES_33 \w{66} OP_SWAP OP_SIZE OP_PUSHBYTES_1 20 OP_EQUAL OP_IF OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUALVERIFY OP_PUSHNUM_2 OP_SWAP OP_PUSHBYTES_33 \w{66} OP_PUSHNUM_2 OP_CHECKMULTISIG OP_ELSE OP_DROP OP_PUSHBYTES_3 \w{6} OP_CLTV OP_DROP OP_CHECKSIG OP_ENDIF (OP_PUSHNUM_1 OP_CSV OP_DROP |)OP_ENDIF$/.test(script_asm)
    ) {
      // https://github.com/lightning/bolts/blob/master/03-transactions.md#offered-htlc-outputs
      // https://github.com/lightning/bolts/blob/master/03-transactions.md#received-htlc-outputs
      if (topElement.length === 66) {
        // top element is a public key
        return ScriptTemplates.ln_htlc_revoked();
      } else if (topElement) {
        // top element is a preimage
        return ScriptTemplates.ln_htlc();
      } else {
        // top element is '' to get in the expiry of the script
        return ScriptTemplates.ln_htlc_expired();
      }
    } else if (/^OP_PUSHBYTES_33 \w{66} OP_CHECKSIG OP_IFDUP OP_NOTIF OP_PUSHNUM_16 OP_CSV OP_ENDIF$/.test(script_asm)) {
      // https://github.com/lightning/bolts/blob/master/03-transactions.md#to_local_anchor-and-to_remote_anchor-output-option_anchors
      if (topElement) {
        // top element is a signature
        return ScriptTemplates.ln_anchor();
      } else {
        // top element is '', it has been swept after 16 blocks
        return ScriptTemplates.ln_anchor_swept();
      }
    }
  }

  const multisig = parseMultisigScript(script_asm);
  if (multisig) {
    return ScriptTemplates.multisig(multisig.m, multisig.n);
  }

  return;
}

/** extracts m and n from a multisig script (asm), returns nothing if it is not a multisig script */
export function parseMultisigScript(script: string): undefined | { m: number, n: number } {
  if (!script) {
    return;
  }
  const ops = script.split(' ');
  if (ops.length < 3 || ops.pop() !== 'OP_CHECKMULTISIG') {
    return;
  }
  const opN = ops.pop();
  if (!opN) {
    return;
  }
  if (opN !== 'OP_0' && !opN.startsWith('OP_PUSHNUM_')) {
    return;
  }
  const n = parseInt(opN.match(/[0-9]+/)?.[0] || '', 10);
  if (ops.length < n * 2 + 1) {
    return;
  }
  // pop n public keys
  for (let i = 0; i < n; i++) {
    if (!/^0((2|3)\w{64}|4\w{128})$/.test(ops.pop() || '')) {
      return;
    }
    if (!/^OP_PUSHBYTES_(33|65)$/.test(ops.pop() || '')) {
      return;
    }
  }
  const opM = ops.pop();
  if (!opM) {
    return;
  }
  if (opM !== 'OP_0' && !opM.startsWith('OP_PUSHNUM_')) {
    return;
  }
  const m = parseInt(opM.match(/[0-9]+/)?.[0] || '', 10);

  if (ops.length) {
    return;
  }

  return { m, n };
}

export function getVarIntLength(n: number): number {
  if (n < 0xfd) {
    return 1;
  } else if (n <= 0xffff) {
    return 3;
  } else if (n <= 0xffffffff) {
    return 5;
  } else {
    return 9;
  }
}

function powMod(x: bigint, power: number, modulo: bigint): bigint {
  for (let i = 0; i < power; i++) {
    x = (x * x) % modulo;
  }
  return x;
}

function sqrtMod(x: bigint, P: bigint): bigint {
  const b2 = (x * x * x) % P;
  const b3 = (b2 * b2 * x) % P;
  const b6 = (powMod(b3, 3, P) * b3) % P;
  const b9 = (powMod(b6, 3, P) * b3) % P;
  const b11 = (powMod(b9, 2, P) * b2) % P;
  const b22 = (powMod(b11, 11, P) * b11) % P;
  const b44 = (powMod(b22, 22, P) * b22) % P;
  const b88 = (powMod(b44, 44, P) * b44) % P;
  const b176 = (powMod(b88, 88, P) * b88) % P;
  const b220 = (powMod(b176, 44, P) * b44) % P;
  const b223 = (powMod(b220, 3, P) * b3) % P;
  const t1 = (powMod(b223, 23, P) * b22) % P;
  const t2 = (powMod(t1, 6, P) * b2) % P;
  const root = powMod(t2, 2, P);
  return root;
}

const curveP = BigInt(`0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F`);

/**
 * This function tells whether the point given is a DER encoded point on the ECDSA curve.
 * @param {string} pointHex The point as a hex string (*must not* include a '0x' prefix)
 * @returns {boolean} true if the point is on the SECP256K1 curve
 */
export function isPoint(pointHex: string): boolean {
  if (!pointHex?.length) {
    return false;
  }
  if (
    !(
      // is uncompressed
      (
        (pointHex.length === 130 && pointHex.startsWith('04')) ||
        // OR is compressed
        (pointHex.length === 66 &&
          (pointHex.startsWith('02') || pointHex.startsWith('03')))
      )
    )
  ) {
    return false;
  }

  // Function modified slightly from noble-curves
  

  // Now we know that pointHex is a 33 or 65 byte hex string.
  const isCompressed = pointHex.length === 66;

  const x = BigInt(`0x${pointHex.slice(2, 66)}`);
  if (x >= curveP) {
    return false;
  }

  if (!isCompressed) {
    const y = BigInt(`0x${pointHex.slice(66, 130)}`);
    if (y >= curveP) {
      return false;
    }
    // Just check y^2 = x^3 + 7 (secp256k1 curve)
    return (y * y) % curveP === (x * x * x + 7n) % curveP;
  } else {
    // Get unaltered y^2 (no mod p)
    const ySquared = (x * x * x + 7n) % curveP;
    // Try to sqrt it, it will round down if not perfect root
    const y = sqrtMod(ySquared, curveP);
    // If we square and it's equal, then it was a perfect root and valid point.
    return (y * y) % curveP === ySquared;
  }
}