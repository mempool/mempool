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
          const controlBlock = v.witness[v.witness.length - 1].startsWith('50') ? v.witness[v.witness.length - 2] : v.witness[v.witness.length - 1];
          this.processScript(new ScriptInfo('inner_witnessscript', undefined, v.inner_witnessscript_asm, v.witness, controlBlock));
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

  private processScript(script: ScriptInfo): void {
    this.scripts.set(script.key, script);
    if (script.template?.type === 'multisig') {
      this.isMultisig = { m: script.template['m'], n: script.template['n'] };
    }
  }
}
