// The only module that loads the Bitcoin libraries, so they stay in the wallet's lazy chunk.

import { base58, hex } from '@scure/base';
import { Address, NETWORK, OutScript, TEST_NETWORK } from '@scure/btc-signer';
import { AddressDecoder, parseAddressList } from '@app/watch/address-list';
import { DescriptorDeriver, descriptorMatchesNetwork, keyFingerprint, parseDescriptor } from '@app/watch/descriptor';
import {
  Base58Codec,
  buildDescriptor,
  keyMatchesNetwork,
  looksLikeDescriptor,
  looksLikeExtendedKey,
  normalizeExtendedKey,
  parseKeyOrigin,
  toMultipathDescriptor,
  validateDescriptorChecksum,
} from '@app/watch/watch-key.utils';
import { InputError } from '@app/watch/input-error';
import { RequestCancelledError } from '@app/watch/api-retry';
import { Chain, ScriptType, WatchNetwork } from '@app/watch/watch.types';

export interface PreparedInput {
  descriptor: string;
  scriptType: string;
  fingerprint?: string;
  fingerprintIsMaster: boolean;
  originPath?: string;
}

export interface AddressScript {
  address: string;
  scriptPubKey: string;
}

// Yield to the page after this many ms of derivation.
export const DERIVE_SLICE_MS = 20;

const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const notCancelled = (): boolean => false;

/** Checked after each await, so cancelled work neither derives further nor fills the cache. */
function throwIfCancelled(isCancelled: () => boolean): void {
  if (isCancelled()) {
    throw new RequestCancelledError();
  }
}

const sha256 = async (data: Uint8Array): Promise<Uint8Array> => {
  const buf = await crypto.subtle.digest('SHA-256', data as unknown as BufferSource);
  return new Uint8Array(buf);
};

const b58: Base58Codec = { decode: (value) => base58.decode(value), encode: (value) => base58.encode(value) };

const PRIVATE_KEY_RE = /(?:xprv|yprv|zprv|tprv|uprv|vprv)[1-9A-HJ-NP-Za-km-z]{80,}/i;
const WIF_RE = /(?:^|[^1-9A-HJ-NP-Za-km-z])(?:[59][1-9A-HJ-NP-Za-km-z]{50}|[KLc][1-9A-HJ-NP-Za-km-z]{51})(?![1-9A-HJ-NP-Za-km-z])/;
const DESCRIPTOR_XPUB_RE = /(xpub|ypub|zpub|tpub|upub|vpub)[1-9A-HJ-NP-Za-km-z]{100,112}/g;

async function normalizeDescriptorKeys(descriptor: string, network: WatchNetwork): Promise<string> {
  const keys = descriptor.match(DESCRIPTOR_XPUB_RE) ?? [];
  let normalized = descriptor;
  for (const key of keys) {
    const result = await normalizeExtendedKey(key, b58, sha256);
    if (!keyMatchesNetwork(result.keyNetwork, network)) {
      throw new InputError('descriptor-key-network', { keyNetwork: result.keyNetwork, network });
    }
    normalized = normalized.replace(key, result.xpub);
  }
  return normalized;
}

const derivers = new Map<string, DescriptorDeriver>();

function getDeriver(descriptor: string): DescriptorDeriver {
  let deriver = derivers.get(descriptor);
  if (!deriver) {
    deriver = new DescriptorDeriver(parseDescriptor(descriptor));
    derivers.set(descriptor, deriver);
  }
  return deriver;
}

export function clearDerivers(): void {
  derivers.clear();
}

function rejectPrivateKeys(input: string): void {
  if (PRIVATE_KEY_RE.test(input) || WIF_RE.test(input)) {
    throw new InputError('private-key');
  }
}

/** `scriptTypeHint` overrides the script type of a bare xpub, which is ambiguous. */
export async function prepareInput(
  rawInput: string,
  network: WatchNetwork,
  scriptTypeHint?: ScriptType,
  isCancelled: () => boolean = notCancelled,
): Promise<PreparedInput> {
  const input = rawInput.trim();
  rejectPrivateKeys(input);

  let descriptor: string;
  let scriptType: ScriptType | string;
  let fingerprint: string | undefined;
  let fingerprintIsMaster = false;
  let originPath: string | undefined;

  if (looksLikeDescriptor(input)) {
    validateDescriptorChecksum(input);
    const withoutChecksum = input.replace(/#[a-z0-9]{8}$/i, '');
    const normalized = await normalizeDescriptorKeys(withoutChecksum, network);
    throwIfCancelled(isCancelled);
    descriptor = toMultipathDescriptor(normalized);
    scriptType = getDeriver(descriptor).desc.descType;

    const origin = parseKeyOrigin(input);
    if (origin) {
      fingerprint = origin.masterFingerprint;
      fingerprintIsMaster = true;
      originPath = origin.path;
    }
  } else if (looksLikeExtendedKey(input)) {
    const norm = await normalizeExtendedKey(input, b58, sha256);
    throwIfCancelled(isCancelled);
    if (!keyMatchesNetwork(norm.keyNetwork, network)) {
      throw new InputError('key-network', { keyNetwork: norm.keyNetwork, network: network });
    }
    scriptType = scriptTypeHint ?? norm.scriptType;
    descriptor = buildDescriptor(norm.xpub, scriptType as ScriptType);

    // A bare key has no master fingerprint; show its own, which is the master's only at depth 0.
    const key = getDeriver(descriptor).desc.key.key;
    fingerprint = keyFingerprint(key);
    fingerprintIsMaster = key.depth === 0;
  } else {
    throw new InputError('unrecognized-input');
  }

  const desc = getDeriver(descriptor).desc;
  if (!descriptorMatchesNetwork(desc, network)) {
    throw new InputError('descriptor-network', { network: network });
  }
  return { descriptor, scriptType, fingerprint, fingerprintIsMaster, originPath };
}

export async function deriveAddresses(
  descriptor: string,
  network: WatchNetwork,
  chain: Chain,
  from: number,
  count: number,
  isCancelled: () => boolean = notCancelled,
): Promise<AddressScript[]> {
  throwIfCancelled(isCancelled);
  const deriver = getDeriver(descriptor);
  const addresses: AddressScript[] = [];
  let sliceStart = performance.now();
  for (let i = 0; i < count; i++) {
    if (performance.now() - sliceStart >= DERIVE_SLICE_MS) {
      await yieldToEventLoop();
      throwIfCancelled(isCancelled);
      sliceStart = performance.now();
    }
    addresses.push(deriver.addressAt(network, chain, from + i));
  }
  return addresses;
}

const decodeAddress: AddressDecoder = (address, family) => {
  const codec = Address(family === 'mainnet' ? NETWORK : TEST_NETWORK);
  const script = codec.decode(address);
  return { address: codec.encode(script), scriptPubKey: hex.encode(OutScript.encode(script)) };
};

export function validateAddressList(input: string, network: WatchNetwork): AddressScript[] {
  // Checked first because a bad entry is quoted back in the error message.
  rejectPrivateKeys(input);
  return parseAddressList(input, network, decodeAddress);
}
