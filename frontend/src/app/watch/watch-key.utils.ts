// No Bitcoin library here: derivation.ts injects base58check.

import { InputError } from '@app/watch/input-error';
import { ScriptType, WatchNetwork } from '@app/watch/watch.types';

export interface Base58CheckCodec {
  decode(str: string): Uint8Array;
  encode(bytes: Uint8Array): string;
}

// SLIP-132 prefixes. Descriptors accept only xpub/tpub, so keys are rewritten and the
// script type the prefix encodes is carried separately.
const SLIP132: Record<string, { version: number; script: ScriptType | null; network: 'mainnet' | 'testnet' }> = {
  xpub: { version: 0x0488b21e, script: 'pkh',     network: 'mainnet' },
  ypub: { version: 0x049d7cb2, script: 'sh_wpkh', network: 'mainnet' },
  zpub: { version: 0x04b24746, script: 'wpkh',    network: 'mainnet' },
  Ypub: { version: 0x0295b43f, script: null,      network: 'mainnet' },
  Zpub: { version: 0x02aa7ed3, script: null,      network: 'mainnet' },
  tpub: { version: 0x043587cf, script: 'pkh',     network: 'testnet' },
  upub: { version: 0x044a5262, script: 'sh_wpkh', network: 'testnet' },
  vpub: { version: 0x045f1cf6, script: 'wpkh',    network: 'testnet' },
  Upub: { version: 0x024289ef, script: null,      network: 'testnet' },
  Vpub: { version: 0x02575483, script: null,      network: 'testnet' },
};

const CANONICAL_VERSION = { mainnet: 0x0488b21e, testnet: 0x043587cf };

const PRIVATE_KEY_VERSIONS: Record<string, number> = {
  xprv: 0x0488ade4,
  yprv: 0x049d7878,
  zprv: 0x04b2430c,
  tprv: 0x04358394,
  uprv: 0x044a4e28,
  vprv: 0x045f18bc,
  // SLIP-132 multisig keys.
  Yprv: 0x0295b005,
  Zprv: 0x02aa7a99,
  Uprv: 0x024285b5,
  Vprv: 0x02575048,
};
const WIF_VERSIONS = [0x80, 0xef];
const INPUT_SEPARATORS = /[\s,;()[\]/]+/;
const KEY_TOKEN_RE = /^[1-9A-HJ-NP-Za-km-z]{51,112}$/;

// Ypub/Zpub/Upub/Vpub are multisig cosigner keys: matched so they get a clear error.
const EXTENDED_KEY_RE = /^(xpub|ypub|zpub|Ypub|Zpub|tpub|upub|vpub|Upub|Vpub)[1-9A-HJ-NP-Za-km-z]{100,112}$/;

export function looksLikeDescriptor(input: string): boolean {
  return /^(pkh|wpkh|sh|wsh|tr|combo|addr|raw|multi|sortedmulti)\s*\(/.test(input.trim());
}

export function looksLikeExtendedKey(input: string): boolean {
  return EXTENDED_KEY_RE.test(input.trim());
}

export const BARE_KEY_SCRIPT_TYPES: readonly ScriptType[] = ['wpkh', 'sh_wpkh', 'pkh', 'tr'];

export function isBareKeyScriptType(value: string): value is ScriptType {
  return (BARE_KEY_SCRIPT_TYPES as readonly string[]).includes(value);
}

/** A plain xpub/tpub, which, unlike a zpub or a descriptor, does not say its script type. */
export function isBareExtendedKey(input: string): boolean {
  return looksLikeExtendedKey(input) && /^(xpub|tpub)/.test(input.trim());
}

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
  scriptType: ScriptType | null;
  /** Signet keys use testnet's version bytes. */
  keyNetwork: 'mainnet' | 'testnet';
}

/** A bare xpub/tpub yields 'pkh', but is ambiguous; the import form asks for the type. */
export function normalizeExtendedKey(key: string, b58check: Base58CheckCodec): NormalizedKey {
  const trimmed = key.trim();
  const prefix = trimmed.slice(0, 4);
  const meta = SLIP132[prefix];
  if (!meta) {
    throw new InputError('xpub-prefix', { prefix, expected: Object.keys(SLIP132).join(', ') });
  }

  // A mistyped key must fail here, not derive an empty wallet that belongs to nobody.
  let payload: Uint8Array;
  try {
    payload = b58check.decode(trimmed);
  } catch {
    throw new InputError('xpub-checksum');
  }
  if (payload.length !== 78) {
    throw new InputError('xpub-length');
  }

  if (readUInt32BE(payload, 0) !== meta.version) {
    throw new InputError('xpub-version', { prefix });
  }

  const swapped = new Uint8Array(payload);
  writeUInt32BE(swapped, CANONICAL_VERSION[meta.network], 0);

  return { xpub: b58check.encode(swapped), scriptType: meta.script, keyNetwork: meta.network };
}

function isPrivateKey(token: string, b58check: Base58CheckCodec): boolean {
  if (!KEY_TOKEN_RE.test(token)) {
    return false;
  }
  let payload: Uint8Array;
  try {
    payload = b58check.decode(token);
  } catch {
    return false;
  }
  if (payload.length === 78) {
    return Object.values(PRIVATE_KEY_VERSIONS).includes(readUInt32BE(payload, 0));
  }
  return (payload.length === 33 || payload.length === 34) && WIF_VERSIONS.includes(payload[0]);
}

export function containsPrivateKey(input: string, b58check: Base58CheckCodec): boolean {
  for (const token of input.split(INPUT_SEPARATORS)) {
    if (isPrivateKey(token, b58check)) {
      return true;
    }
  }
  return false;
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

/**
 * Rewrite single-path `/0/*` or `/1/*` keys to `/<0;1>/*`, so both chains are covered. Only when
 * every key ends in the same one: with any other ending, which chain is receive is a guess, so the
 * text is left for the parser to refuse. A descriptor that already has a multipath element is left
 * alone: its single-path keys are cosigners that use the same path on both chains (BIP-389).
 */
export function toMultipathDescriptor(descriptor: string): string {
  const trimmed = descriptor.trim();
  validateDescriptorChecksum(trimmed);
  const d = trimmed.replace(/#[a-z0-9]{8}$/i, '');
  if (/<[^<>]*;[^<>]*>/.test(d)) {
    return d;
  }
  const endings = new Set(d.match(/\/[01]\/\*/g));
  if (endings.size > 1) {
    throw new InputError('descriptor-multipath-mixed');
  }
  // Every `*` must be preceded by that same /0/ or /1/ step.
  const ranged = d.match(/\*/g)?.length ?? 0;
  const rewritable = (d.match(/\/[01]\/\*/g)?.length ?? 0) === ranged;
  return rewritable ? d.replace(/\/[01]\/\*/g, '/<0;1>/*') : d;
}

export type ScriptKind = 'wpkh' | 'shwpkh' | 'pkh' | 'tr' | 'wsh' | 'shwsh' | 'sh';

const SCRIPT_KINDS: readonly string[] = ['wpkh', 'shwpkh', 'pkh', 'tr', 'wsh', 'shwsh', 'sh'];

/** Accepts both ScriptType ('sh_wpkh') and descriptor.ts's DescType ('ShWpkh'). */
export function scriptKind(scriptType: string): ScriptKind | null {
  const kind = (scriptType || '').toLowerCase().replace('_', '');
  return SCRIPT_KINDS.includes(kind) ? kind as ScriptKind : null;
}

/** The standard account path is shown only when the real one is not known. */
export function describeScriptType(scriptType: string): { code: string; path?: string } {
  switch (scriptKind(scriptType)) {
    case 'wpkh':   return { code: 'P2WPKH', path: 'm/84\'/0\'/0\'' };
    case 'shwpkh': return { code: 'P2SH-P2WPKH', path: 'm/49\'/0\'/0\'' };
    case 'pkh':    return { code: 'P2PKH', path: 'm/44\'/0\'/0\'' };
    case 'tr':     return { code: 'P2TR', path: 'm/86\'/0\'/0\'' };
    case 'wsh':    return { code: 'P2WSH' };
    case 'shwsh':  return { code: 'P2SH-P2WSH' };
    case 'sh':     return { code: 'P2SH' };
    default:       return { code: scriptType };
  }
}

const KEY_ORIGIN_RE = /\[[0-9a-fA-F]{8}(?:\/\d+['hH]?)*\]/g;

export function normalizeOriginMarkers(descriptor: string): string {
  return descriptor.replace(KEY_ORIGIN_RE, (origin) => origin.replace(/H/g, '\''));
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
