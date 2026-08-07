import '@angular/localize/init';
import { ScriptInfo, getVarIntLength } from '@app/shared/script.utils';
import { Vin, Vout } from '@interfaces/electrs.interface';
import { BECH32_CHARS_LW, BASE58_CHARS, HEX_CHARS } from '@app/shared/regex.utils';
import { parseTaproot } from './transaction.utils';

export type AddressType = 'fee'
  | 'empty'
  | 'provably_unspendable'
  | 'op_return'
  | 'multisig'
  | 'p2pk'
  | 'p2pkh'
  | 'p2sh'
  | 'p2sh-p2wpkh'
  | 'p2sh-p2wsh'
  | 'v0_p2wpkh'
  | 'v0_p2wsh'
  | 'v1_p2tr'
  | 'confidential'
  | 'anchor'
  | 'unknown'

const ADDRESS_PREFIXES = {
  mainnet: {
    base58: {
      pubkey: ['1'],
      script: ['3'],
    },
    bech32: 'bc1',
  },
  testnet: {
    base58: {
      pubkey: ['m', 'n'],
      script: '2',
    },
    bech32: 'tb1',
  },
  testnet4: {
    base58: {
      pubkey: ['m', 'n'],
      script: '2',
    },
    bech32: 'tb1',
  },
  signet: {
    base58: {
      pubkey: ['m', 'n'],
      script: '2',
    },
    bech32: 'tb1',
  },
  regtest: {
    base58: {
      pubkey: ['m', 'n'],
      script: '2',
    },
    bech32: 'bcrt1',
  },
  liquid: {
    base58: {
      pubkey: ['P','Q'],
      script: ['G','H'],
      confidential: ['V'],
    },
    bech32: 'ex1',
    confidential: 'lq1',
  },
  liquidtestnet: {
    base58: {
      pubkey: ['F'],
      script: ['8','9'],
      confidential: ['V'], // TODO: check if this is actually correct
    },
    bech32: 'tex1',
    confidential: 'tlq1',
  },
};

// precompiled regexes for common address types (excluding prefixes)
const base58Regex = RegExp('^' + BASE58_CHARS + '{26,34}$');
const confidentialb58Regex = RegExp('^[TJ]' + BASE58_CHARS + '{78}$');
const p2wpkhRegex = RegExp('^q' + BECH32_CHARS_LW + '{38}$');
const p2wshRegex = RegExp('^q' + BECH32_CHARS_LW + '{58}$');
const p2trRegex = RegExp('^p' + BECH32_CHARS_LW + '{58}$');
const pubkeyRegex = RegExp('^' + `(04${HEX_CHARS}{128})|(0[23]${HEX_CHARS}{64})$`);

export function detectAddressType(address: string, network: string): AddressType {
  network = network || 'mainnet';
  // normal address types
  const firstChar = address.substring(0, 1);
  if (ADDRESS_PREFIXES[network].base58.pubkey.includes(firstChar) && base58Regex.test(address.slice(1))) {
    return 'p2pkh';
  } else if (ADDRESS_PREFIXES[network].base58.script.includes(firstChar) && base58Regex.test(address.slice(1))) {
    return 'p2sh';
  } else if (address.startsWith(ADDRESS_PREFIXES[network].bech32)) {
    const suffix = address.slice(ADDRESS_PREFIXES[network].bech32.length);
    if (p2wpkhRegex.test(suffix)) {
      return 'v0_p2wpkh';
    } else if (p2wshRegex.test(suffix)) {
      return 'v0_p2wsh';
    } else if (p2trRegex.test(suffix)) {
      return 'v1_p2tr';
    }
  }

  // p2pk
  if (pubkeyRegex.test(address)) {
    return 'p2pk';
  }

  // liquid-specific types
  if (network.startsWith('liquid')) {
    if (ADDRESS_PREFIXES[network].base58.confidential.includes(firstChar) && confidentialb58Regex.test(address.slice(1))) {
      return 'confidential';
    } else if (address.startsWith(ADDRESS_PREFIXES[network].confidential)) {
      return 'confidential';
    }
  }

  return 'unknown';
}

/**
 * Parses & classifies address types + properties from address strings
 *
 * can optionally augment this data with examples of spends from the address,
 * e.g. to classify revealed scripts for scripthash-type addresses.
 */
export class AddressTypeInfo {
  network: string;
  address: string;
  type: AddressType;
  // script data
  scripts: Map<string, ScriptInfo>; // raw script
  // flags
  isMultisig?: { m: number, n: number };
  tapscript?: boolean;
  simplicity?: boolean;
  observedInputVsize?: number; // median realized input vsize from previous spends

  constructor (network: string, address: string, type?: AddressType, vin?: Vin[], vout?: Vout) {
    this.network = network;
    this.address = address;
    this.scripts = new Map();
    if (type) {
      this.type = type;
    } else {
      this.type = detectAddressType(address, network);
    }
    this.processInputs(vin);
    if (vout) {
      this.processOutput(vout);
    }
  }

  public clone(): AddressTypeInfo {
    const cloned = new AddressTypeInfo(this.network, this.address, this.type);
    cloned.scripts = new Map(Array.from(this.scripts, ([key, value]) => [key, value?.clone()]));
    cloned.isMultisig = this.isMultisig;
    cloned.tapscript = this.tapscript;
    cloned.simplicity = this.simplicity;
    cloned.observedInputVsize = this.observedInputVsize;
    return cloned;
  }

  public processInputs(vin: Vin[] = [], vinIds: string[] = []): void {
    // taproot can have multiple script paths
    if (this.type === 'v1_p2tr') {
      for (let i = 0; i < vin.length; i++) {
        const v = vin[i];
        if (!v.taprootInfo) {
          v.taprootInfo = parseTaproot(v.witness);
        }
        const taprootInfo = v.taprootInfo;
        if (taprootInfo.scriptPath) {
          if (taprootInfo.scriptPath.leafVersion === 0xc0 && v.inner_witnessscript_asm) {
            this.tapscript = true;
            this.processScript(new ScriptInfo('inner_witnessscript', taprootInfo.scriptPath.script, v.inner_witnessscript_asm, v.witness, taprootInfo, vinIds?.[i]));
          } else if (this.network === 'liquid' || this.network === 'liquidtestnet' && taprootInfo.scriptPath.leafVersion === 0xbe) {
            this.simplicity = true;
            v.inner_simplicityscript = v.witness[1];
            this.processScript(new ScriptInfo('inner_simplicityscript', taprootInfo.scriptPath.simplicityScript, null, v.witness, taprootInfo, vinIds?.[i]));
          }
        }
      }
    // for single-script types, if we've seen one input we've seen them all
    } else if (['p2sh', 'v0_p2wsh'].includes(this.type)) {
      if (!this.scripts.size && vin.length) {
        const v = vin[0];
        // wrapped segwit
        if (this.type === 'p2sh' && v.witness?.length) {
          if (v.scriptsig.startsWith('160014')) {
            this.type = 'p2sh-p2wpkh';
          } else if (v.scriptsig.startsWith('220020')) {
            this.type = 'p2sh-p2wsh';
          }
        }
        // real script
        if (this.type !== 'p2sh-p2wpkh') {
          if (v.inner_witnessscript_asm) {
            this.processScript(new ScriptInfo('inner_witnessscript', undefined, v.inner_witnessscript_asm, v.witness));
          } else if (v.inner_redeemscript_asm) {
            this.processScript(new ScriptInfo('inner_redeemscript', undefined, v.inner_redeemscript_asm, v.witness));
          } else if (v.scriptsig || v.scriptsig_asm) {
            this.processScript(new ScriptInfo('scriptsig', v.scriptsig, v.scriptsig_asm, v.witness));
          }
        }
      }
    } else if (this.type === 'multisig') {
      if (vin.length) {
        const v = vin[0];
        this.processScript(new ScriptInfo('scriptpubkey', v.prevout.scriptpubkey, v.prevout.scriptpubkey_asm));
      }
    } else if (this.type === 'unknown') {
      for (const v of vin) {
        if (v.prevout?.scriptpubkey === '51024e73') {
          this.type = 'anchor';
        }
      }
    }
    // and there's nothing more to learn from processing inputs for other types
  }

  public processOutput(output: Vout): void {
    if (this.type === 'multisig') {
      if (!this.scripts.size) {
        this.processScript(new ScriptInfo('scriptpubkey', output.scriptpubkey, output.scriptpubkey_asm));
      }
    } else if (this.type === 'unknown') {
      if (output.scriptpubkey === '51024e73') {
        this.type = 'anchor';
      }
    }
  }

  public compareTo(other: AddressTypeInfo): AddressSimilarityResult {
    return compareAddresses(this.address, other.address, this.network);
  }

  public compareToString(other: string): AddressSimilarityResult {
    if (other === this.address) {
      return { status: 'identical' };
    }
    const otherInfo = new AddressTypeInfo(this.network, other);
    return this.compareTo(otherInfo);
  }

  public processScript(script: ScriptInfo): boolean {
    if (this.scripts.has(script.key)) {
      return false;
    }
    this.scripts.set(script.key, script);
    if (script.template?.type === 'multisig') {
      this.isMultisig = { m: script.template['m'], n: script.template['n'] };
    }
    return true;
  }
}

// vsize of typical transaction overhead when spending a UTXO in its own
// transaction: version + locktime + in/out counts + segwit marker/flag (~11 vB)
// plus one typical output (~31 vB for a p2wpkh recipient).
export const TX_OVERHEAD_VSIZE = 11;
export const TYPICAL_OUTPUT_VSIZE = 31;

// estimated vsize (vB) of a single input spending each address type, for the
// common single-key case. Derived from the per-component byte costs documented
// in fillUnsignedInput (transaction.utils.ts): DER sig 72 B, pubkey 34 B,
// Schnorr sig 65 B, with the 4x witness discount applied.
const INPUT_VSIZE: Partial<Record<AddressType, number>> = {
  p2pk: 114,
  p2pkh: 148,
  'p2sh-p2wpkh': 91,
  v0_p2wpkh: 68,
  v1_p2tr: 58, // keyspend
};

// rough vsize of an m-of-n multisig input. `wrapped` adds the p2sh redeemscript
// pushed in the scriptsig (p2sh-p2wsh); otherwise native p2wsh.
function multisigWitnessInputVsize(m: number, n: number, wrapped: boolean): number {
  // wrapped (p2sh-p2wsh) scriptsig pushes the 34-byte witness program: 1-byte push opcode + 34 bytes
  const nonWitness = wrapped ? 76 : 41; // outpoint + sequence (+ redeemscript push)
  const witnessScript = 3 + n * 34; // OP_m + n*push33 + OP_n + OP_CHECKMULTISIG
  // stack: item count + dummy + m*(length prefix + signature) + script length prefix + script
  const witnessBytes = 1 + 1 + m * (1 + 72) + getVarIntLength(witnessScript) + witnessScript;
  return Math.ceil(nonWitness + witnessBytes / 4); // consensus vsize rounds up
}

// realized weight (WU) of a spent input, reconstructed from its on-chain scriptsig + witness
function vinWeightUnits(vin: Vin): number | null {
  if (!vin || vin.is_coinbase) {
    return null;
  }
  const scriptsigLen = (vin.scriptsig?.length || 0) / 2;
  const base = 36 + getVarIntLength(scriptsigLen) + scriptsigLen + 4;
  let witnessBytes = 0;
  // count witness only when present; legacy inputs carry no witness section
  if (vin.witness && vin.witness.length) {
    witnessBytes += getVarIntLength(vin.witness.length);
    for (const item of vin.witness) {
      const itemLen = item.length / 2;
      witnessBytes += getVarIntLength(itemLen) + itemLen;
    }
  }
  return base * 4 + witnessBytes;
}

/**
 * Median realized input vsize (vB) across previous spends, or undefined if none
 * are measurable. Kept fractional so rounding error doesn't accumulate per UTXO.
 */
export function observedInputVsize(vins: Vin[]): number | undefined {
  const vsizes = (vins || [])
    .map((v) => vinWeightUnits(v))
    .filter((wu): wu is number => wu !== null && wu > 0)
    .map((wu) => wu / 4);
  if (!vsizes.length) {
    return undefined;
  }
  vsizes.sort((a, b) => a - b);
  const mid = Math.floor(vsizes.length / 2);
  return vsizes.length % 2 ? vsizes[mid] : (vsizes[mid - 1] + vsizes[mid]) / 2;
}

/**
 * Estimates the vsize (vB) of a single input spending from this address.
 *
 * `estimated` flags address types whose input size is variable (multisig,
 * p2wsh, tapscript script-path, unknown) and therefore only approximated.
 *
 * `observedVsize`, when provided, is the realized vsize of an input extracted
 * from a previous spend and always takes priority over the type-based estimate.
 */
export function estimateInputVsize(info: AddressTypeInfo, observedVsize?: number): { vsize: number; estimated: boolean } {
  if (observedVsize !== undefined) {
    return { vsize: observedVsize, estimated: false };
  }

  switch (info.type) {
    case 'p2pk':
    case 'p2pkh':
    case 'p2sh-p2wpkh':
    case 'v0_p2wpkh':
      return { vsize: INPUT_VSIZE[info.type], estimated: false };
    case 'v1_p2tr':
      // 58 vB is a typical key-path estimate; without an observed spend we
      // can't tell key-path from a (variable) script-path spend, so it stays
      // approximate
      return { vsize: INPUT_VSIZE.v1_p2tr, estimated: true };
    case 'v0_p2wsh':
      if (info.isMultisig) {
        return { vsize: multisigWitnessInputVsize(info.isMultisig.m, info.isMultisig.n, false), estimated: true };
      }
      return { vsize: 105, estimated: true }; // assume 2-of-3
    case 'p2sh-p2wsh':
      if (info.isMultisig) {
        return { vsize: multisigWitnessInputVsize(info.isMultisig.m, info.isMultisig.n, true), estimated: true };
      }
      return { vsize: 139, estimated: true }; // assume 2-of-3
    case 'multisig':
      if (info.isMultisig) {
        // bare multisig: signatures + redeemscript in the scriptsig (no discount)
        return { vsize: 41 + info.isMultisig.m * 73 + (3 + info.isMultisig.n * 34), estimated: true };
      }
      return { vsize: 252, estimated: true }; // assume 2-of-3
    case 'p2sh':
      // unresolved p2sh (no spend seen yet): assume nested segwit single-key
      return { vsize: INPUT_VSIZE['p2sh-p2wpkh'], estimated: true };
    default:
      return { vsize: INPUT_VSIZE.v0_p2wpkh, estimated: true };
  }
}

export interface AddressMatch {
  prefix: string;
  postfix: string;
}

export interface AddressSimilarity {
  status: 'comparable';
  score: number;
  left: AddressMatch;
  right: AddressMatch;
}
export type AddressSimilarityResult =
  | { status: 'identical' }
  | { status: 'incomparable' }
  | AddressSimilarity;

export const ADDRESS_SIMILARITY_THRESHOLD = 1_000_000; // 1 false positive per ~1 million comparisons

function fuzzyPrefixMatch(a: string, b: string, rtl: boolean = false): { score: number, matchA: string, matchB: string } {
  let score = 0;
  let gap = false;
  let done = false;

  let ai = 0;
  let bi = 0;
  let prefixA = '';
  let prefixB = '';
  if (rtl) {
    a = a.split('').reverse().join('');
    b = b.split('').reverse().join('');
  }

  let discounted = false;
  while (ai < a.length && bi < b.length && !done) {
    if (a[ai] === b[bi]) {
      // matching characters
      prefixA += a[ai];
      prefixB += b[bi];
      if (discounted) {
        score += 0.5;
      } else {
        score ++;
      }
      discounted = false;
      ai++;
      bi++;
    } else if (!gap) {
      // try looking ahead in both strings to find the best match
      const nextMatchA = (ai + 1 < a.length && a[ai + 1] === b[bi]);
      const nextMatchB = (bi + 1 < b.length && a[ai] === b[bi + 1]);
      const nextMatchBoth = (ai + 1 < a.length && bi + 1 < b.length && a[ai + 1] === b[bi + 1]);
      if (nextMatchBoth) {
        // single differing character
        prefixA += a[ai];
        prefixB += b[bi];
        ai++;
        bi++;
      } else if (nextMatchA) {
        // character missing in b
        prefixA += a[ai];
        ai++;
      } else if (nextMatchB) {
        // character missing in a
        prefixB += b[bi];
        bi++;
      } else {
        ai++;
        bi++;
      }
      gap = true;
      discounted = true;
    } else {
      done = true;
    }
  }

  if (rtl) {
    prefixA = prefixA.split('').reverse().join('');
    prefixB = prefixB.split('').reverse().join('');
  }

  return { score, matchA: prefixA, matchB: prefixB };
}

export function compareAddressInfo(a: AddressTypeInfo, b: AddressTypeInfo): AddressSimilarityResult {
  if (a.address === b.address) {
    return { status: 'identical' };
  }
  if (a.type !== b.type) {
    return { status: 'incomparable' };
  }
  if (!['p2pkh', 'p2sh', 'p2sh-p2wpkh', 'p2sh-p2wsh', 'v0_p2wpkh', 'v0_p2wsh', 'v1_p2tr'].includes(a.type)) {
    return { status: 'incomparable' };
  }
  const isBase58 = a.type === 'p2pkh' || a.type === 'p2sh';

  const left = fuzzyPrefixMatch(a.address, b.address);
  const right = fuzzyPrefixMatch(a.address, b.address, true);
  // depending on address type, some number of matching prefix characters are guaranteed
  const prefixScore = isBase58 ? 1 : (ADDRESS_PREFIXES[a.network || 'mainnet'].bech32.length + 1);

  // add the two scores together
  const totalScore = left.score + right.score - prefixScore;

  // adjust for the size of the alphabet (58 vs 32)
  const normalizedScore = Math.pow(isBase58 ? 58 : 32, totalScore);

  return {
    status: 'comparable',
    score: normalizedScore,
    left: {
      prefix: left.matchA,
      postfix: right.matchA,
    },
    right: {
      prefix: left.matchB,
      postfix: right.matchB,
    },
  };
}

export function compareAddresses(a: string, b: string, network: string): AddressSimilarityResult {
  if (a === b) {
    return { status: 'identical' };
  }
  const aInfo = new AddressTypeInfo(network, a);
  return aInfo.compareToString(b);
}

// avoids the overhead of creating AddressTypeInfo objects for each address,
// but a and b *MUST* be valid normalized addresses, of the same valid type
export function checkedCompareAddressStrings(a: string, b: string, type: AddressType, network: string): AddressSimilarityResult {
  return compareAddressInfo(
    { address: a, type: type, network: network } as AddressTypeInfo,
    { address: b, type: type, network: network } as AddressTypeInfo,
  );
}

