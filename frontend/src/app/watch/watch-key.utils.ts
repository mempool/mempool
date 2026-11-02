// No Bitcoin library here: derivation.ts injects base58 and SHA-256.

import { InputError } from '@app/watch/input-error';
import { ScriptType, WatchNetwork } from '@app/watch/watch.types';

export interface Base58Codec {
  decode(str: string): Uint8Array;
  encode(bytes: Uint8Array): string;
}

export type Sha256 = (data: Uint8Array) => Promise<Uint8Array>;

// SLIP-132 prefixes. Descriptors accept only xpub/tpub, so keys are rewritten and the
// script type the prefix encodes is carried separately.
const SLIP132: Record<string, { version: number; script: ScriptType; network: 'mainnet' | 'testnet' }> = {
  xpub: { version: 0x0488b21e, script: 'pkh',     network: 'mainnet' },
  ypub: { version: 0x049d7cb2, script: 'sh_wpkh', network: 'mainnet' },
  zpub: { version: 0x04b24746, script: 'wpkh',    network: 'mainnet' },
  tpub: { version: 0x043587cf, script: 'pkh',     network: 'testnet' },
  upub: { version: 0x044a5262, script: 'sh_wpkh', network: 'testnet' },
  vpub: { version: 0x045f1cf6, script: 'wpkh',    network: 'testnet' },
};

const CANONICAL_VERSION = { mainnet: 0x0488b21e, testnet: 0x043587cf };

const EXTENDED_KEY_RE = /^(xpub|ypub|zpub|tpub|upub|vpub)[1-9A-HJ-NP-Za-km-z]{100,112}$/;

export function looksLikeDescriptor(input: string): boolean {
  return /^(pkh|wpkh|sh|wsh|tr|combo|addr|raw|multi|sortedmulti)\s*\(/.test(input.trim());
}

export function looksLikeExtendedKey(input: string): boolean {
  return EXTENDED_KEY_RE.test(input.trim());
}

export const BARE_KEY_SCRIPT_TYPES: readonly ScriptType[] = ['wpkh', 'sh_wpkh', 'pkh', 'tr'];

function readUInt32BE(b: Uint8Array, offset: number): number {
  return ((b[offset] << 24) | (b[offset + 1] << 16) | (b[offset + 2] << 8) | b[offset + 3]) >>> 0;
}

function writeUInt32BE(b: Uint8Array, value: number, offset: number): void {
  b[offset] = (value >>> 24) & 0xff;
  b[offset + 1] = (value >>> 16) & 0xff;
  b[offset + 2] = (value >>> 8) & 0xff;
  b[offset + 3] = value & 0xff;
}

export interface NormalizedKey {
  xpub: string;
  scriptType: ScriptType;
  /** Signet keys use testnet's version bytes. */
  keyNetwork: 'mainnet' | 'testnet';
}

/** A bare xpub/tpub yields 'pkh', but is ambiguous; the import form asks for the type. */
export async function normalizeExtendedKey(key: string, b58: Base58Codec, sha256: Sha256): Promise<NormalizedKey> {
  const trimmed = key.trim();
  const prefix = trimmed.slice(0, 4);
  const meta = SLIP132[prefix];
  if (!meta) {
    throw new InputError('xpub-prefix', { prefix, expected: Object.keys(SLIP132).join(', ') });
  }

  const raw = b58.decode(trimmed);
  if (raw.length !== 82) {
    throw new InputError('xpub-length');
  }
  const payload = raw.subarray(0, 78);
  const checksum = raw.subarray(78);

  // A mistyped key must fail here, not derive an empty wallet that belongs to nobody.
  const expected = (await sha256(await sha256(payload))).subarray(0, 4);
  for (let i = 0; i < 4; i++) {
    if (checksum[i] !== expected[i]) {
      throw new InputError('xpub-checksum');
    }
  }

  if (readUInt32BE(payload, 0) !== meta.version) {
    throw new InputError('xpub-version', { prefix });
  }

  const swapped = new Uint8Array(payload);
  writeUInt32BE(swapped, CANONICAL_VERSION[meta.network], 0);

  const newChecksum = (await sha256(await sha256(swapped))).subarray(0, 4);
  const out = new Uint8Array(82);
  out.set(swapped, 0);
  out.set(newChecksum, 78);

  return { xpub: b58.encode(out), scriptType: meta.script, keyNetwork: meta.network };
}

export function buildDescriptor(xpub: string, scriptType: ScriptType): string {
  const inner = `${xpub}/<0;1>/*`;
  switch (scriptType) {
    case 'pkh':     return `pkh(${inner})`;
    case 'sh_wpkh': return `sh(wpkh(${inner}))`;
    case 'wpkh':    return `wpkh(${inner})`;
    case 'tr':      return `tr(${inner})`;
  }
}

const DESCRIPTOR_INPUT_CHARSET = '0123456789()[],\'/*abcdefgh@:$%{}IJKLMNOPQRSTUVWXYZ&+-.;<=>?!^_|~ijklmnopqrstuvwxyzABCDEFGH`#"\\ ';
const DESCRIPTOR_CHECKSUM_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function descriptorChecksum(body: string): string {
  const polymod = (checksum: bigint, value: number): bigint => {
    const top = checksum >> 35n;
    let next = ((checksum & 0x7ffffffffn) << 5n) ^ BigInt(value);
    const generators = [0xf5dee51989n, 0xa9fdca3312n, 0x1bab10e32dn, 0x3706b1677an, 0x644d626ffdn];
    generators.forEach((generator, index) => {
      if ((top >> BigInt(index)) & 1n) {
        next ^= generator;
      }
    });
    return next;
  };
  let checksum = 1n;
  let cls = 0;
  let clsCount = 0;
  for (const char of body) {
    const position = DESCRIPTOR_INPUT_CHARSET.indexOf(char);
    if (position < 0) {
      throw new InputError('descriptor-character', { char });
    }
    checksum = polymod(checksum, position & 31);
    cls = cls * 3 + (position >> 5);
    if (++clsCount === 3) {
      checksum = polymod(checksum, cls);
      cls = 0;
      clsCount = 0;
    }
  }
  if (clsCount) {
    checksum = polymod(checksum, cls);
  }
  for (let i = 0; i < 8; i++) {
    checksum = polymod(checksum, 0);
  }
  checksum ^= 1n;
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += DESCRIPTOR_CHECKSUM_CHARSET[Number((checksum >> BigInt(5 * (7 - i))) & 31n)];
  }
  return result;
}

export function validateDescriptorChecksum(descriptor: string): void {
  const separator = descriptor.lastIndexOf('#');
  if (separator < 0) {
    return;
  }
  const body = descriptor.slice(0, separator);
  const supplied = descriptor.slice(separator + 1);
  if (!/^[a-z0-9]{8}$/i.test(supplied) || descriptorChecksum(body) !== supplied) {
    throw new InputError('descriptor-checksum');
  }
}

/** Rewrite a single-path `/0/*` or `/1/*` to `/<0;1>/*`, so both chains are covered. */
export function toMultipathDescriptor(descriptor: string): string {
  const trimmed = descriptor.trim();
  validateDescriptorChecksum(trimmed);
  const d = trimmed.replace(/#[a-z0-9]{8}$/i, '');
  if (/<[^<>]*;[^<>]*>/.test(d)) {
    return d;
  }
  const single = /\/([01])\/\*/g;
  if (single.test(d)) {
    return d.replace(single, '/<0;1>/*');
  }
  return d;
}

export type ScriptKind = 'wpkh' | 'shwpkh' | 'pkh' | 'tr';

/** Accepts both ScriptType ('sh_wpkh') and descriptor.ts's DescType ('ShWpkh'). */
export function scriptKind(scriptType: string): ScriptKind | null {
  const kind = (scriptType || '').toLowerCase().replace('_', '');
  return ['wpkh', 'shwpkh', 'pkh', 'tr'].includes(kind) ? kind as ScriptKind : null;
}

/** The standard account path is shown only when the real one is not known. */
export function describeScriptType(scriptType: string): { code: string; path?: string } {
  switch (scriptKind(scriptType)) {
    case 'wpkh':   return { code: 'P2WPKH', path: 'm/84\'/0\'/0\'' };
    case 'shwpkh': return { code: 'P2SH-P2WPKH', path: 'm/49\'/0\'/0\'' };
    case 'pkh':    return { code: 'P2PKH', path: 'm/44\'/0\'/0\'' };
    case 'tr':     return { code: 'P2TR', path: 'm/86\'/0\'/0\'' };
    default:       return { code: scriptType };
  }
}

export interface KeyOrigin {
  masterFingerprint: string;
  path?: string;
}

// Only a descriptor's key origin carries the master fingerprint; a bare xpub's
// parentFingerprint is that of its parent (e.g. m/84'/0').
export function parseKeyOrigin(descriptor: string): KeyOrigin | null {
  const match = descriptor.match(/\[\s*([0-9a-fA-F]{8})((?:\/\d+['h]?)*)\s*\]/);
  if (!match) {
    return null;
  }
  const path = match[2] ? `m${match[2].replace(/h/g, '\'')}` : undefined;
  return { masterFingerprint: match[1].toLowerCase(), path };
}

export function fromMempoolNetwork(network: string): WatchNetwork | null {
  switch (network) {
    case '':
    case 'bitcoin':  return 'mainnet';
    case 'testnet':  return 'testnet';
    case 'signet':   return 'signet';
    default:         return null;
  }
}

// A key from the wrong network would derive addresses with no history and look like an empty wallet.
export function keyMatchesNetwork(keyNetwork: 'mainnet' | 'testnet', network: WatchNetwork): boolean {
  return keyNetwork === (network === 'mainnet' ? 'mainnet' : 'testnet');
}
