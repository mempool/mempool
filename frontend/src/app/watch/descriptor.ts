/**
 * BIP-380 descriptor parsing and derivation for public keys only, on @scure/bip32 and
 * @scure/btc-signer: pkh, sh(wpkh), wpkh and tr(KEY), each with one key of the form KEY/<0;1>/*.
 * Whitespace is rejected, not stripped: `/1 0/` would become `/10/`, and the stored text
 * must be exactly what was derived.
 */

import { HDKey } from '@scure/bip32';
import { hex } from '@scure/base';
import { NETWORK, TEST_NETWORK, p2pkh, p2sh, p2tr, p2wpkh } from '@scure/btc-signer';
import { InputError, InputErrorCode, InputErrorParams } from '@app/watch/input-error';
import { WatchNetwork } from '@app/watch/watch.types';

export type DescType = 'Pkh' | 'ShWpkh' | 'Wpkh' | 'Tr';

const HARDENED = 0x80000000;
const TPUB_VERSIONS = { private: 0x04358394, public: 0x043587cf };

export interface DescriptorKey {
  originFingerprint?: string;
  originPath: number[];
  xpub: string;
  key: HDKey;
  /** Always [0, 1]: receive and change. */
  multipath: number[];
}

export interface ParsedDescriptor {
  descType: DescType;
  key: DescriptorKey;
}

export interface DerivedAddress {
  address: string;
  scriptPubKey: string;
}

function fail(code: InputErrorCode, params?: InputErrorParams): never {
  throw new InputError(code, params);
}

function parsePathStep(step: string, allowHardened: boolean): number {
  const match = /^(\d+)(['hH]?)$/.exec(step);
  if (!match) {
    fail('descriptor-step-invalid', { step });
  }
  const value = Number(match[1]);
  if (!Number.isSafeInteger(value) || value >= HARDENED) {
    fail('descriptor-step-range', { step });
  }
  if (match[2]) {
    if (!allowHardened) {
      fail('descriptor-hardened-step');
    }
    return value + HARDENED;
  }
  return value;
}

function parseKey(text: string): DescriptorKey {
  let rest = text.trim();
  let originFingerprint: string | undefined;
  const originPath: number[] = [];

  if (rest.startsWith('[')) {
    const end = rest.indexOf(']');
    if (end < 0) {
      fail('descriptor-origin-unclosed');
    }
    const parts = rest.slice(1, end).split('/');
    if (!/^[0-9a-fA-F]{8}$/.test(parts[0])) {
      fail('descriptor-origin-fingerprint');
    }
    originFingerprint = parts[0].toLowerCase();
    for (const step of parts.slice(1)) {
      originPath.push(parsePathStep(step, true));
    }
    rest = rest.slice(end + 1);
  }

  const segments = rest.split('/');
  const xpub = segments[0];
  if (!/^(xpub|tpub)[1-9A-HJ-NP-Za-km-z]+$/.test(xpub)) {
    if (/^(0[23][0-9a-fA-F]{64}|[0-9a-fA-F]{64}|04[0-9a-fA-F]{128})$/.test(xpub)) {
      fail('descriptor-fixed-key');
    }
    fail('descriptor-key-type');
  }
  let key: HDKey;
  try {
    key = HDKey.fromExtendedKey(xpub, xpub.startsWith('tpub') ? TPUB_VERSIONS : undefined);
  } catch (e) {
    fail('descriptor-key-invalid', { reason: e instanceof Error ? e.message : String(e) });
  }
  if (key.privateKey) {
    fail('private-key');
  }

  const steps = segments.slice(1);
  if (steps[steps.length - 1] !== '*') {
    fail('descriptor-key-unranged');
  }
  const body = steps.slice(0, -1);
  if (body.includes('*')) {
    fail('descriptor-wildcard');
  }
  const multipathAt = body.map((s, i) => (s.startsWith('<') ? i : -1)).filter((i) => i >= 0);
  if (multipathAt.length > 1) {
    fail('descriptor-multipath-count');
  }
  if (multipathAt.length === 0) {
    fail('descriptor-no-multipath');
  }
  const multipathMatch = /^<([^<>]+)>$/.exec(body[multipathAt[0]]);
  if (!multipathMatch) {
    fail('descriptor-multipath-invalid', { element: body[multipathAt[0]] });
  }
  const multipath = multipathMatch[1].split(';').map((s) => parsePathStep(s, false));
  if (multipath.length !== 2 || multipath[0] !== 0 || multipath[1] !== 1) {
    fail('descriptor-multipath-values', { element: body[multipathAt[0]] });
  }
  // Extra steps would make the displayed derivation paths wrong.
  if (body.length !== 1) {
    fail('descriptor-path-steps');
  }

  return { originFingerprint, originPath, xpub, key, multipath };
}

function unwrap(text: string): [string, string] | null {
  const match = /^([a-z]+)\((.*)\)$/s.exec(text.trim());
  if (!match) {
    return null;
  }
  let depth = 0;
  const inner = match[2];
  for (const c of inner) {
    if (c === '(') {
      depth++;
    } else if (c === ')' && --depth < 0) {
      return null;
    }
  }
  return depth === 0 ? [match[1], inner] : null;
}

/** Expects the checksum already validated and stripped. */
export function parseDescriptor(descriptor: string): ParsedDescriptor {
  const text = descriptor.trim();
  if (/\s/.test(text)) {
    fail('descriptor-whitespace');
  }
  if (text.includes('#')) {
    fail('descriptor-checksum-present');
  }
  const outer = unwrap(text);
  if (!outer) {
    fail('descriptor-unrecognized');
  }
  const [fn, inner] = outer;

  switch (fn) {
    case 'pkh':
      return { descType: 'Pkh', key: parseKey(inner) };
    case 'wpkh':
      return { descType: 'Wpkh', key: parseKey(inner) };
    case 'tr':
      if (inner.includes(',')) {
        fail('descriptor-taproot-script');
      }
      return { descType: 'Tr', key: parseKey(inner) };
    case 'sh': {
      const nested = unwrap(inner);
      if (nested?.[0] !== 'wpkh') {
        fail('descriptor-sh-inner');
      }
      return { descType: 'ShWpkh', key: parseKey(nested[1]) };
    }
    default:
      fail('descriptor-function', { fn });
  }
}

function btcNetwork(network: WatchNetwork): typeof NETWORK {
  return network === 'mainnet' ? NETWORK : TEST_NETWORK;
}

export function descriptorMatchesNetwork(desc: ParsedDescriptor, network: WatchNetwork): boolean {
  return desc.key.xpub.startsWith(network === 'mainnet' ? 'xpub' : 'tpub');
}

/** Caches each chain's node, so an address costs one child derivation. */
export class DescriptorDeriver {
  private chainKeys = new Map<number, HDKey>();

  constructor(readonly desc: ParsedDescriptor) {}

  private chainKey(chain: number): HDKey {
    let node = this.chainKeys.get(chain);
    if (!node) {
      node = this.desc.key.key.deriveChild(this.desc.key.multipath[chain]);
      this.chainKeys.set(chain, node);
    }
    return node;
  }

  publicKeyAt(chain: number, index: number): Uint8Array {
    if (!Number.isInteger(chain) || chain < 0 || chain >= this.desc.key.multipath.length) {
      fail('descriptor-chain', { chain });
    }
    if (!Number.isInteger(index) || index < 0 || index >= HARDENED) {
      fail('descriptor-index', { index });
    }
    const pub = this.chainKey(chain).deriveChild(index).publicKey;
    if (!pub) {
      fail('derivation-no-public-key');
    }
    return pub;
  }

  addressAt(network: WatchNetwork, chain: number, index: number): DerivedAddress {
    const net = btcNetwork(network);
    const pubkey = this.publicKeyAt(chain, index);
    let payment: { address?: string; script: Uint8Array };
    switch (this.desc.descType) {
      case 'Pkh': payment = p2pkh(pubkey, net); break;
      case 'Wpkh': payment = p2wpkh(pubkey, net); break;
      case 'ShWpkh': payment = p2sh(p2wpkh(pubkey, net), net); break;
      case 'Tr': payment = p2tr(pubkey.subarray(1), undefined, net); break;
    }
    if (!payment.address) {
      fail('derivation-no-address');
    }
    return { address: payment.address, scriptPubKey: hex.encode(payment.script) };
  }
}

export function keyFingerprint(key: HDKey): string {
  return key.fingerprint.toString(16).padStart(8, '0');
}

export function formatOriginPath(path: number[]): string | undefined {
  if (!path.length) {
    return undefined;
  }
  return ['m', ...path.map((step) => (step >= HARDENED ? `${step - HARDENED}'` : `${step}`))].join('/');
}
