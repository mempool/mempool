/**
 * BIP-380 descriptor parsing and derivation for public keys only, on @scure/bip32 and
 * @scure/btc-signer: pkh, sh(wpkh), wpkh and tr(KEY), and multi/sortedmulti inside wsh, sh(wsh)
 * or sh, each key of the form KEY/<0;1>/*. A multisig cosigner may instead use one fixed step,
 * KEY/n/*, which it then uses on both chains (BIP-389).
 * Whitespace is rejected, not stripped: `/1 0/` would become `/10/`, and the stored text
 * must be exactly what was derived.
 */

import { HDKey } from '@scure/bip32';
import { hex } from '@scure/base';
import { NETWORK, TEST_NETWORK, p2ms, p2pkh, p2sh, p2tr, p2wpkh, p2wsh } from '@scure/btc-signer';
import { InputError, InputErrorCode, InputErrorParams } from '@app/watch/input-error';
import { WatchNetwork } from '@app/watch/watch.types';

export type SingleKeyDescType = 'Pkh' | 'ShWpkh' | 'Wpkh' | 'Tr';
export type MultisigDescType = 'Wsh' | 'ShWsh' | 'Sh';
export type DescType = SingleKeyDescType | MultisigDescType;

const HARDENED = 0x80000000;
const TPUB_VERSIONS = { private: 0x04358394, public: 0x043587cf };
const MAX_SH_MULTISIG_KEYS = 15;
const MAX_WSH_MULTISIG_KEYS = 16;

export interface DescriptorKey {
  originFingerprint?: string;
  originPath: number[];
  xpub: string;
  key: HDKey;
  /** The step per chain: [0, 1] for receive and change, or [n, n] for a single-path key. */
  multipath: number[];
  /** KEY/n/* rather than KEY/<0;1>/*; allowed only next to a multipath key (BIP-389). */
  singlePath: boolean;
  /** KEY/* with no step at all; refused once the other keys are known. */
  noStep?: boolean;
}

export interface SingleKeyDescriptor {
  descType: SingleKeyDescType;
  keys: DescriptorKey[];
}

export interface MultisigDescriptor {
  descType: MultisigDescType;
  keys: DescriptorKey[];
  threshold: number;
  sorted: boolean;
}

export type ParsedDescriptor = SingleKeyDescriptor | MultisigDescriptor;

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
    if (body.length === 0) {
      return { originFingerprint, originPath, xpub, key, multipath: [], singlePath: true, noStep: true };
    }
    // Extra steps would make the displayed derivation paths wrong.
    if (body.length !== 1) {
      fail('descriptor-path-steps');
    }
    const step = parsePathStep(body[0], false);
    return { originFingerprint, originPath, xpub, key, multipath: [step, step], singlePath: true };
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

  return { originFingerprint, originPath, xpub, key, multipath, singlePath: false };
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

  const desc = parseFunction(fn, inner);
  if (desc.keys.every((key) => key.singlePath)) {
    fail('descriptor-no-multipath');
  }
  // Next to a <0;1> key, KEY/* needs a step: …/<0;1>/* or one fixed step such as …/0/*.
  if (desc.keys.some((key) => key.noStep)) {
    fail('descriptor-path-steps');
  }
  return desc;
}

function parseFunction(fn: string, inner: string): ParsedDescriptor {
  switch (fn) {
    case 'pkh':
      return { descType: 'Pkh', keys: [parseKey(inner)] };
    case 'wpkh':
      return { descType: 'Wpkh', keys: [parseKey(inner)] };
    case 'tr':
      if (inner.includes(',')) {
        fail('descriptor-taproot-script');
      }
      return { descType: 'Tr', keys: [parseKey(inner)] };
    case 'wsh':
      return parseMultisig('Wsh', inner, MAX_WSH_MULTISIG_KEYS);
    case 'sh':
      return parseSh(inner);
    default:
      fail('descriptor-function', { fn });
  }
}

function parseSh(inner: string): ParsedDescriptor {
  const [fn, nested] = unwrap(inner) ?? ['', ''];
  switch (fn) {
    case 'wpkh':
      return { descType: 'ShWpkh', keys: [parseKey(nested)] };
    case 'wsh':
      return parseMultisig('ShWsh', nested, MAX_WSH_MULTISIG_KEYS);
    case 'multi':
    case 'sortedmulti':
      return parseMultisig('Sh', inner, MAX_SH_MULTISIG_KEYS);
    default:
      fail('descriptor-sh-inner');
  }
}

function parseMultisig(descType: MultisigDescType, text: string, maxKeys: number): MultisigDescriptor {
  const multi = unwrap(text);
  if (multi?.[0] !== 'multi' && multi?.[0] !== 'sortedmulti') {
    fail('descriptor-wsh-inner');
  }
  const [thresholdText, ...keyTexts] = multi[1].split(',');
  const threshold = /^\d+$/.test(thresholdText) ? Number(thresholdText) : NaN;
  if (keyTexts.length > maxKeys) {
    fail('descriptor-multisig-keys', { max: maxKeys, count: keyTexts.length });
  }
  if (!(threshold >= 1 && threshold <= keyTexts.length)) {
    fail('descriptor-multisig-threshold', { threshold: thresholdText, count: keyTexts.length });
  }
  const keys = keyTexts.map(parseKey);
  // The same xpub on different steps is allowed (Bitcoin Core accepts it); on the same step it is not.
  for (const chain of [0, 1]) {
    if (new Set(keys.map((k) => `${k.xpub}/${k.multipath[chain]}`)).size !== keys.length) {
      fail('descriptor-multisig-duplicate');
    }
  }
  return { descType, keys, threshold, sorted: multi[0] === 'sortedmulti' };
}

function btcNetwork(network: WatchNetwork): typeof NETWORK {
  return network === 'mainnet' ? NETWORK : TEST_NETWORK;
}

export function descriptorMatchesNetwork(desc: ParsedDescriptor, network: WatchNetwork): boolean {
  return desc.keys.every((key) => key.xpub.startsWith(network === 'mainnet' ? 'xpub' : 'tpub'));
}

function multisigScript(desc: MultisigDescriptor, pubkeys: Uint8Array[]): ReturnType<typeof p2ms> {
  const ordered = desc.sorted ? [...pubkeys].sort((a, b) => (hex.encode(a) < hex.encode(b) ? -1 : 1)) : pubkeys;
  return p2ms(desc.threshold, ordered);
}

/** Caches each chain's node, so an address costs one child derivation. */
export class DescriptorDeriver {
  private chainKeys = new Map<number, HDKey[]>();

  constructor(readonly desc: ParsedDescriptor) {}

  private chainNodes(chain: number): HDKey[] {
    let nodes = this.chainKeys.get(chain);
    if (!nodes) {
      nodes = this.desc.keys.map((key) => key.key.deriveChild(key.multipath[chain]));
      this.chainKeys.set(chain, nodes);
    }
    return nodes;
  }

  publicKeysAt(chain: number, index: number): Uint8Array[] {
    if (!Number.isInteger(chain) || chain < 0 || chain >= this.desc.keys[0].multipath.length) {
      fail('descriptor-chain', { chain });
    }
    if (!Number.isInteger(index) || index < 0 || index >= HARDENED) {
      fail('descriptor-index', { index });
    }
    return this.chainNodes(chain).map((node) => node.deriveChild(index).publicKey ?? fail('derivation-no-public-key'));
  }

  addressAt(network: WatchNetwork, chain: number, index: number): DerivedAddress {
    const net = btcNetwork(network);
    const pubkeys = this.publicKeysAt(chain, index);
    const desc = this.desc;
    let payment: { address?: string; script: Uint8Array };
    switch (desc.descType) {
      case 'Pkh': payment = p2pkh(pubkeys[0], net); break;
      case 'Wpkh': payment = p2wpkh(pubkeys[0], net); break;
      case 'ShWpkh': payment = p2sh(p2wpkh(pubkeys[0], net), net); break;
      case 'Tr': payment = p2tr(pubkeys[0].subarray(1), undefined, net); break;
      case 'Wsh': payment = p2wsh(multisigScript(desc, pubkeys), net); break;
      case 'ShWsh': payment = p2sh(p2wsh(multisigScript(desc, pubkeys), net), net); break;
      case 'Sh': payment = p2sh(multisigScript(desc, pubkeys), net); break;
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
