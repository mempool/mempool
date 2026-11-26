// The only module that loads the Bitcoin libraries, so they stay in the wallet's lazy chunk.

import { createBase58check, hex } from '@scure/base';
import { Address, NETWORK, OutScript, TEST_NETWORK } from '@scure/btc-signer';
import { hash as sha256 } from '@app/shared/sha256';
import { AddressDecoder, parseAddressList } from '@app/watch/address-list';
import { DescriptorDeriver, DescriptorKey, descriptorMatchesNetwork, formatOriginPath, keyFingerprint, parseDescriptor } from '@app/watch/descriptor';
import {
  BARE_KEY_SCRIPT_TYPES,
  Base58CheckCodec,
  buildDescriptor,
  containsPrivateKey,
  isBareExtendedKey,
  keyMatchesNetwork,
  looksLikeDescriptor,
  looksLikeExtendedKey,
  normalizeExtendedKey,
  normalizeOriginMarkers,
  toMultipathDescriptor,
  validateDescriptorChecksum,
} from '@app/watch/watch-key.utils';
import { InputError } from '@app/watch/input-error';
import { RequestCancelledError } from '@app/watch/api-retry';
import { Chain, KeyInfo, MultisigInfo, ScriptType, WatchNetwork } from '@app/watch/watch.types';

export interface PreparedInput {
  descriptor: string;
  scriptType: string;
  fingerprint?: string;
  fingerprintIsMaster: boolean;
  originPath?: string;
  multisig?: MultisigInfo;
}

export interface AddressScript {
  address: string;
  scriptPubKey: string;
}

export interface ScriptCandidate {
  scriptType: ScriptType;
  address: string;
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

const b58check: Base58CheckCodec = createBase58check(sha256);

const DESCRIPTOR_XPUB_RE = /(xpub|ypub|zpub|Ypub|Zpub|tpub|upub|vpub|Upub|Vpub)[1-9A-HJ-NP-Za-km-z]{100,112}/g;

function normalizeDescriptorKeys(descriptor: string, network: WatchNetwork): string {
  const keys = descriptor.match(DESCRIPTOR_XPUB_RE) ?? [];
  let normalized = descriptor;
  for (const key of keys) {
    const result = normalizeExtendedKey(key, b58check);
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
  if (containsPrivateKey(input, b58check)) {
    throw new InputError('private-key');
  }
}

/** `scriptTypeHint` overrides the script type of a bare xpub, which is ambiguous. */
export function prepareInput(rawInput: string, network: WatchNetwork, scriptTypeHint?: ScriptType): PreparedInput {
  const input = rawInput.trim();
  rejectPrivateKeys(input);

  let descriptor: string;
  let scriptType: ScriptType | string;

  if (looksLikeDescriptor(input)) {
    validateDescriptorChecksum(input);
    const withoutChecksum = input.replace(/#[a-z0-9]{8}$/i, '');
    const normalized = normalizeDescriptorKeys(withoutChecksum, network);
    descriptor = normalizeOriginMarkers(toMultipathDescriptor(normalized));
    scriptType = getDeriver(descriptor).desc.descType;
  } else if (looksLikeExtendedKey(input)) {
    const norm = normalizeExtendedKey(input, b58check);
    if (!keyMatchesNetwork(norm.keyNetwork, network)) {
      throw new InputError('key-network', { keyNetwork: norm.keyNetwork, network: network });
    }
    if (!norm.scriptType) {
      // A Ypub/Zpub is one cosigner of a multisig; the other keys and threshold are in the descriptor.
      throw new InputError('xpub-multisig-key', { prefix: input.slice(0, 4) });
    }
    const bareType = scriptTypeHint ?? norm.scriptType;
    scriptType = bareType;
    descriptor = buildDescriptor(norm.xpub, bareType);
  } else {
    throw new InputError('unrecognized-input');
  }

  const desc = getDeriver(descriptor).desc;
  if (!descriptorMatchesNetwork(desc, network)) {
    throw new InputError('descriptor-network', { network: network });
  }
  if ('threshold' in desc) {
    return {
      descriptor,
      scriptType,
      fingerprintIsMaster: false,
      multisig: { threshold: desc.threshold, keys: desc.keys.map(keyInfo) },
    };
  }
  return { descriptor, scriptType, ...keyInfo(desc.keys[0]) };
}

function keyInfo(key: DescriptorKey): KeyInfo {
  return {
    fingerprint: key.originFingerprint ?? keyFingerprint(key.key),
    fingerprintIsMaster: !!key.originFingerprint || key.key.depth === 0,
    originPath: formatOriginPath(key.originPath),
    ...(key.singlePath ? { fixedStep: key.multipath[0] } : {}),
  };
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

/** Receive address 0 of a bare xpub/tpub under each script type it may use; empty for other input. */
export function scriptCandidates(rawInput: string, network: WatchNetwork): ScriptCandidate[] {
  const input = rawInput.trim();
  if (!isBareExtendedKey(input)) {
    return [];
  }
  const norm = normalizeExtendedKey(input, b58check);
  if (!keyMatchesNetwork(norm.keyNetwork, network)) {
    throw new InputError('key-network', { keyNetwork: norm.keyNetwork, network: network });
  }
  return BARE_KEY_SCRIPT_TYPES.map((scriptType) => ({
    scriptType,
    address: getDeriver(buildDescriptor(norm.xpub, scriptType)).addressAt(network, 0, 0).address,
  }));
}
