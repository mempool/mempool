import { Env } from '@app/services/state.service';

// all base58 characters
export const BASE58_CHARS = `[a-km-zA-HJ-NP-Z1-9]`;

// all bech32 characters (after the separator)
export const BECH32_CHARS_LW = `[ac-hj-np-z02-9]`;
const BECH32_CHARS_UP = `[AC-HJ-NP-Z02-9]`;

// Hex characters
export const HEX_CHARS = `[a-fA-F0-9]`;

// A regex to say "A single 0 OR any number with no leading zeroes"
// Capped at 9 digits so as to not be confused with lightning channel IDs (which are around 17 digits)
// (?:             // Start a non-capturing group
//   0             // A single 0
//   |             // OR
//   [1-9][0-9]{0,8} // Any succession of numbers up to 9 digits starting with 1-9
// )               // End the non-capturing group.
const ZERO_INDEX_NUMBER_CHARS = `(?:0|[1-9][0-9]{0,8})`;

// Simple digits only regex
const NUMBER_CHARS = `[0-9]`;

// Formatting of the address regex is for readability,
// We should ignore formatting it with automated formatting tools like prettier.
//
// prettier-ignore
const ADDRESS_CHARS: {
  [k in Network]: {
    base58: string;
    bech32: string;
  };
} = {
  mainnet: {
    base58: `[13]` // Starts with a single 1 or 3
      + BASE58_CHARS
      + `{26,33}`, // Repeat the previous char 26-33 times.
      // Version byte 0x00 (P2PKH) can be as short as 27 characters, up to 34 length
      // P2SH must be 34 length
    bech32: `(?:`
        + `bc1` // Starts with bc1
        + BECH32_CHARS_LW
        + `{6,100}` // As per bech32, 6 char checksum is minimum
      + `|`
        + `BC1` // All upper case version
        + BECH32_CHARS_UP
        + `{6,100}`
      + `)`,
  },
  testnet: {
    base58: `[mn2]` // Starts with a single m, n, or 2 (P2PKH is m or n, 2 is P2SH)
      + BASE58_CHARS
      + `{33,34}`, // m|n is 34 length, 2 is 35 length (We match the first letter separately)
    bech32: `(?:`
        + `tb1` // Starts with tb1
        + BECH32_CHARS_LW
        + `{6,100}` // As per bech32, 6 char checksum is minimum
      + `|`
        + `TB1` // All upper case version
        + BECH32_CHARS_UP
        + `{6,100}`
      + `)`,
  },
  testnet4: {
    base58: `[mn2]` // Starts with a single m, n, or 2 (P2PKH is m or n, 2 is P2SH)
      + BASE58_CHARS
      + `{33,34}`, // m|n is 34 length, 2 is 35 length (We match the first letter separately)
    bech32: `(?:`
        + `tb1` // Starts with tb1
        + BECH32_CHARS_LW
        + `{6,100}` // As per bech32, 6 char checksum is minimum
      + `|`
        + `TB1` // All upper case version
        + BECH32_CHARS_UP
        + `{6,100}`
      + `)`,
  },
  signet: {
    base58: `[mn2]`
      + BASE58_CHARS
      + `{33,34}`,
    bech32: `(?:`
        + `tb1` // Starts with tb1
        + BECH32_CHARS_LW
        + `{6,100}`
      + `|`
        + `TB1` // All upper case version
        + BECH32_CHARS_UP
        + `{6,100}`
      + `)`,
  },
  liquid: {
    base58: `[GHPQ]` // PQ is P2PKH, GH is P2SH
        + BASE58_CHARS
        + `{33}` // All min-max lengths are 34
      + `|`
        + `[V][TJ]` // Confidential P2PKH or P2SH starts with VT or VJ
        + BASE58_CHARS
        + `{78}`, 
    bech32: `(?:`
        + `(?:` // bech32 liquid starts with ex1 (unconfidential) or lq1 (confidential)
          + `ex1`
          + `|`
          + `lq1`
        + `)`
        + BECH32_CHARS_LW // blech32 and bech32 are the same alphabet and protocol, different checksums.
        + `{6,100}`
      + `|`
        + `(?:` // Same as above but all upper case
          + `EX1`
          + `|`
          + `LQ1`
        + `)`
        + BECH32_CHARS_UP
        + `{6,100}`
      + `)`,
  },
  liquidtestnet: {
    base58: `[89]` // ???(TODO: find version) is P2PKH, 8|9 is P2SH
      + BASE58_CHARS
      + `{33}`, // P2PKH is ???(TODO: find size), P2SH is 34
    bech32: `(?:`
        + `(?:` // bech32 liquid testnet starts with tex or tlq
          + `tex1` // TODO: Why does mempool use this and not ert|el like in the elements source?
          + `|`
          + `tlq1` // TODO: does this exist?
        + `)`
        + BECH32_CHARS_LW // blech32 and bech32 are the same alphabet and protocol, different checksums.
        + `{6,100}`
      + `|`
        + `(?:` // Same as above but all upper case
          + `TEX1`
          + `|`
          + `TLQ1`
        + `)`
        + BECH32_CHARS_UP
        + `{6,100}`
      + `)`,
  },
}
type RegexTypeNoAddrNoBlockHash = | `transaction` | `blockheight` | `date` | `timestamp`;
export type RegexType = `address` | `blockhash` | RegexTypeNoAddrNoBlockHash;

export const NETWORKS = [`testnet`, `testnet4`, `signet`, `liquid`, `liquidtestnet`, `mainnet`] as const;
export type Network = typeof NETWORKS[number]; // Turn const array into union type

export const ADDRESS_REGEXES: [RegExp, Network][] = NETWORKS
  .map(network => [getRegex('address', network), network])

export function findOtherNetworks(address: string, skipNetwork: Network, env: Env): { network: Network, address: string, isNetworkAvailable: boolean }[] {
  return ADDRESS_REGEXES
    .filter(([regex, network]) => network !== skipNetwork && regex.test(address))
    .map(([, network]) => ({ network, address, isNetworkAvailable: isNetworkAvailable(network, env) }));
}

function isNetworkAvailable(network: Network, env: Env): boolean {
  switch (network) {
    case 'testnet':
      return env.TESTNET_ENABLED === true;
    case 'testnet4':
      return env.TESTNET4_ENABLED === true;
    case 'signet':
      return env.SIGNET_ENABLED === true;
    case 'liquid':
      return env.LIQUID_ENABLED === true;
    case 'liquidtestnet':
      return env.LIQUID_TESTNET_ENABLED === true;
    case 'mainnet':
      return true; // There is no "MAINNET_ENABLED" flag
    default:
      return false;
  }
}

export function needBaseModuleChange(fromBaseModule: 'mempool' | 'liquid', toNetwork: Network): boolean {
  if (!toNetwork) return false; // No target network means no change needed
  if (fromBaseModule === 'mempool') {
    return toNetwork !== 'mainnet' && toNetwork !== 'testnet' && toNetwork !== 'testnet4' && toNetwork !== 'signet';
  }
  if (fromBaseModule === 'liquid') {
    return toNetwork !== 'liquid' && toNetwork !== 'liquidtestnet';
  }
}

export function getTargetUrl(toNetwork: Network, address: string, env: Env): string {
  let targetUrl = '';
  if (toNetwork === 'liquid' || toNetwork === 'liquidtestnet') {
    targetUrl = env.LIQUID_WEBSITE_URL;
    targetUrl += (toNetwork === 'liquidtestnet' ? '/testnet' : '');
    targetUrl += '/address/';
    targetUrl += address;
  }
  if (toNetwork === 'mainnet' || toNetwork === 'testnet' || toNetwork === 'testnet4' || toNetwork === 'signet') {
    targetUrl = env.MEMPOOL_WEBSITE_URL;
    targetUrl += (toNetwork === 'mainnet' ? '' : `/${toNetwork}`);
    targetUrl += '/address/';
    targetUrl += address;
  }
  return targetUrl;
}

export function getRegex(type: RegexTypeNoAddrNoBlockHash): RegExp;
export function getRegex(type: 'address', network: Network): RegExp;
export function getRegex(type: 'blockhash', network: Network): RegExp;
export function getRegex(type: RegexType, network?: Network): RegExp {
  let regex = `^`; // ^ = Start of string
  switch (type) {
    // Match a block height number
    // [Testing Order]: any order is fine
    case `blockheight`:
      regex += ZERO_INDEX_NUMBER_CHARS; // block height is a 0 indexed number
      break;
    // Match a 32 byte block hash in hex.
    // [Testing Order]: Must always be tested before `transaction`
    case `blockhash`:
      if (!network) {
        throw new Error(`Must pass network when type is blockhash`);
      }
      let leadingZeroes: number;
      switch (network) {
        case `mainnet`:
          leadingZeroes = 8; // Assumes at least 32 bits of difficulty
          break;
        case `testnet`:
          leadingZeroes = 8; // Assumes at least 32 bits of difficulty
          break;
        case `testnet4`:
          leadingZeroes = 8; // Assumes at least 32 bits of difficulty
          break;
        case `signet`:
          leadingZeroes = 5;
          break;
        case `liquid`:
          leadingZeroes = 8; // We are not interested in Liquid block hashes
          break;
        case `liquidtestnet`:
          leadingZeroes = 8; // We are not interested in Liquid block hashes
          break;
        default:
          throw new Error(`Invalid Network ${network} (Unreachable error in TypeScript)`);
      }
      regex += `0{${leadingZeroes}}`;
      regex += `${HEX_CHARS}{${64 - leadingZeroes}}`; // Exactly 64 hex letters/numbers
      break;
    // Match a 32 byte tx hash in hex. Contains optional output index specifier.
    // [Testing Order]: Must always be tested after `blockhash`
    case `transaction`:
      regex += `${HEX_CHARS}{64}`; // Exactly 64 hex letters/numbers
      regex += `(?:`; // Start a non-capturing group
      regex += `:`; // 1 instances of the symbol ":"
      regex += ZERO_INDEX_NUMBER_CHARS; // A zero indexed number
      regex += `)?`; // End the non-capturing group. This group appears 0 or 1 times
      break;
    // Match any one of the many address types
    // [Testing Order]: While possible that a bech32 address happens to be 64 hex
    // characters in the future (current lengths are not 64), it is highly unlikely
    // Order therefore, does not matter.
    case `address`:
      if (!network) {
        throw new Error(`Must pass network when type is address`);
      }
      regex += `(?:`; // Start a non-capturing group (each network has multiple options)
      switch (network) {
        case `mainnet`:
          regex += ADDRESS_CHARS.mainnet.base58;
          regex += `|`; // OR
          regex += ADDRESS_CHARS.mainnet.bech32;
          regex += `|`; // OR
          regex += `04${HEX_CHARS}{128}`; // Uncompressed pubkey
          regex += `|`; // OR
          regex += `(?:02|03)${HEX_CHARS}{64}`; // Compressed pubkey
          break;
        case `testnet`:
          regex += ADDRESS_CHARS.testnet.base58;
          regex += `|`; // OR
          regex += ADDRESS_CHARS.testnet.bech32;
          regex += `|`; // OR
          regex += `04${HEX_CHARS}{128}`; // Uncompressed pubkey
          regex += `|`; // OR
          regex += `(?:02|03)${HEX_CHARS}{64}`; // Compressed pubkey
          break;
        case `testnet4`:
          regex += ADDRESS_CHARS.testnet.base58;
          regex += `|`; // OR
          regex += ADDRESS_CHARS.testnet.bech32;
          regex += `|`; // OR
          regex += `04${HEX_CHARS}{128}`; // Uncompressed pubkey
          regex += `|`; // OR
          regex += `(?:02|03)${HEX_CHARS}{64}`; // Compressed pubkey
          break;
        case `signet`:
          regex += ADDRESS_CHARS.signet.base58;
          regex += `|`; // OR
          regex += ADDRESS_CHARS.signet.bech32;
          regex += `|`; // OR
          regex += `04${HEX_CHARS}{128}`; // Uncompressed pubkey
          regex += `|`; // OR
          regex += `(?:02|03)${HEX_CHARS}{64}`; // Compressed pubkey
          break;
        case `liquid`:
          regex += ADDRESS_CHARS.liquid.base58;
          regex += `|`; // OR
          regex += ADDRESS_CHARS.liquid.bech32;
          break;
        case `liquidtestnet`:
          regex += ADDRESS_CHARS.liquidtestnet.base58;
          regex += `|`; // OR
          regex += ADDRESS_CHARS.liquidtestnet.bech32;
          break;
        default:
          throw new Error(`Invalid Network ${network} (Unreachable error in TypeScript)`);
      }
      regex += `)`; // End the non-capturing group
      break;
    // Match a date in the format YYYY-MM-DD (optional: HH:MM or HH:MM:SS)
    // [Testing Order]: any order is fine
    case `date`:
      regex += `(?:`;                  // Start a non-capturing group
      regex += `${NUMBER_CHARS}{4}`;   // Exactly 4 digits
      regex += `[-/]`;                 // 1 instance of the symbol "-" or "/"
      regex += `${NUMBER_CHARS}{1,2}`; // 1 or 2 digits
      regex += `[-/]`;                 // 1 instance of the symbol "-" or "/"
      regex += `${NUMBER_CHARS}{1,2}`; // 1 or 2 digits
      regex += `(?:`;                  // Start a non-capturing group
      regex += ` `;                    // 1 instance of the symbol " "
      regex += `${NUMBER_CHARS}{1,2}`; // 1 or 2 digits
      regex += `:`;                    // 1 instance of the symbol ":"
      regex += `${NUMBER_CHARS}{1,2}`; // 1 or 2 digits
      regex += `(?:`;                  // Start a non-capturing group for optional seconds
      regex += `:`;                    // 1 instance of the symbol ":"
      regex += `${NUMBER_CHARS}{1,2}`; // 1 or 2 digits
      regex += `)?`;                   // End the non-capturing group
      regex += `)?`;                   // End the non-capturing group. This group appears 0 or 1 times
      regex += `)`;                    // End the non-capturing group
      break;
    // Match a unix timestamp
    // [Testing Order]: any order is fine
    case `timestamp`:
      regex += `${NUMBER_CHARS}{10}`; // Exactly 10 digits
      break;
    default:
      throw new Error(`Invalid RegexType ${type} (Unreachable error in TypeScript)`);
  }
  regex += `$`; // $ = End of string
  return new RegExp(regex);
}
