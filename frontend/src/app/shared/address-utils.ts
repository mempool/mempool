import '@angular/localize/init';
import { ScriptInfo } from '@app/shared/script.utils';
import { Vin, Vout } from '@interfaces/electrs.interface';
import { BECH32_CHARS_LW, BASE58_CHARS, HEX_CHARS } from '@app/shared/regex.utils';

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
    return cloned;
  }

  public processInputs(vin: Vin[] = []): void {
    // taproot can have multiple script paths
    if (this.type === 'v1_p2tr') {
      for (const v of vin) {
        if (v.inner_witnessscript_asm) {
          this.tapscript = true;
          const hasAnnex = v.witness[v.witness.length - 1].startsWith('50');
          const controlBlock = hasAnnex ? v.witness[v.witness.length - 2] : v.witness[v.witness.length - 1];
          const scriptHex = hasAnnex ? v.witness[v.witness.length - 3] : v.witness[v.witness.length - 2];
          this.processScript(new ScriptInfo('inner_witnessscript', scriptHex, v.inner_witnessscript_asm, v.witness, controlBlock, v.vinId));
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

  private processScript(script: ScriptInfo): void {
    if (this.scripts.has(script.key)) {
      return;
    }
    this.scripts.set(script.key, script);
    if (script.template?.type === 'multisig') {
      this.isMultisig = { m: script.template['m'], n: script.template['n'] };
    }
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

export const ADDRESS_SIMILARITY_THRESHOLD = 10_000_000; // 1 false positive per ~10 million comparisons

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

  while (ai < a.length && bi < b.length && !done) {
    if (a[ai] === b[bi]) {
      // matching characters
      prefixA += a[ai];
      prefixB += b[bi];
      score++;
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
  const prefixScore = isBase58 ? 1 : ADDRESS_PREFIXES[a.network || 'mainnet'].bech32.length;

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

