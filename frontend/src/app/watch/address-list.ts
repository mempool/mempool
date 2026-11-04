// No Bitcoin library here, so the import form can use the shape check; derivation.ts passes the decoder.

import { InputError } from '@app/watch/input-error';
import { WatchNetwork } from '@app/watch/watch.types';

// Every address is queried on each refresh.
const MAX_LISTED_ADDRESSES = 1000;

const ADDRESS_SHAPE_RE = /^(?:(?:bc|tb|bcrt)1[02-9ac-hj-np-z]{8,87}|[123mn][1-9A-HJ-NP-Za-km-z]{25,34})$/i;

interface ListedEntry {
  /** 1-based. */
  line: number;
  value: string;
}

function splitAddressList(input: string): ListedEntry[] {
  const entries: ListedEntry[] = [];
  input.split(/\r?\n/).forEach((text, i) => {
    for (const value of text.split(/[\s,;]+/)) {
      if (value) {
        entries.push({ line: i + 1, value });
      }
    }
  });
  return entries;
}

// Only the first entry is checked, so a bad entry further down is reported by line
// rather than the whole input being called unrecognized.
export function looksLikeAddressList(input: string): boolean {
  const first = splitAddressList(input)[0];
  return !!first && ADDRESS_SHAPE_RE.test(first.value);
}

export function countListedAddresses(input: string): number {
  return new Set(splitAddressList(input).map((e) => normalizeCase(e.value))).size;
}

/** Bech32 is case-insensitive and the API returns lower case; base58 is case-sensitive. */
function normalizeCase(value: string): string {
  return /^(?:bc|tb|bcrt)1/i.test(value) ? value.toLowerCase() : value;
}

/** Returns the canonical address and its script, or throws if invalid for the family. */
export type AddressDecoder = (address: string, family: 'mainnet' | 'testnet') => { address: string; scriptPubKey: string };

export function parseAddressList(input: string, network: WatchNetwork, decode: AddressDecoder): { address: string; scriptPubKey: string }[] {
  const family = network === 'mainnet' ? 'mainnet' : 'testnet';
  const other = family === 'mainnet' ? 'testnet' : 'mainnet';
  const seen = new Set<string>();
  const addresses: { address: string; scriptPubKey: string }[] = [];

  for (const { line, value } of splitAddressList(input)) {
    let decoded: { address: string; scriptPubKey: string };
    try {
      decoded = decode(normalizeCase(value), family);
    } catch {
      let otherNetwork = false;
      try {
        decode(normalizeCase(value), other);
        otherNetwork = true;
      } catch {
        // Not valid on either network.
      }
      throw otherNetwork
        ? new InputError('address-other-network', { line, address: value, addressNetwork: other, network })
        : new InputError('address-invalid', { line, address: value });
    }
    if (!seen.has(decoded.address)) {
      seen.add(decoded.address);
      addresses.push(decoded);
    }
  }

  if (!addresses.length) {
    throw new InputError('address-list-empty');
  }
  if (addresses.length > MAX_LISTED_ADDRESSES) {
    throw new InputError('address-list-too-long', { max: MAX_LISTED_ADDRESSES, count: addresses.length });
  }
  return addresses;
}
