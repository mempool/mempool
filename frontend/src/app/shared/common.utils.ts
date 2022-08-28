export function isMobile(): boolean {
  return (window.innerWidth <= 767.98);
}

export function getFlagEmoji(countryCode): string {
  if (!countryCode) {
    return '';
  }
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
}

// https://gist.github.com/calebgrove/c285a9510948b633aa47
export function convertRegion(input, to: 'name' | 'abbreviated'): string {
  if (!input) {
    return '';
  }

  const states = [
    ['Alabama', 'AL'],
    ['Alaska', 'AK'],
    ['American Samoa', 'AS'],
    ['Arizona', 'AZ'],
    ['Arkansas', 'AR'],
    ['Armed Forces Americas', 'AA'],
    ['Armed Forces Europe', 'AE'],
    ['Armed Forces Pacific', 'AP'],
    ['California', 'CA'],
    ['Colorado', 'CO'],
    ['Connecticut', 'CT'],
    ['Delaware', 'DE'],
    ['District Of Columbia', 'DC'],
    ['Florida', 'FL'],
    ['Georgia', 'GA'],
    ['Guam', 'GU'],
    ['Hawaii', 'HI'],
    ['Idaho', 'ID'],
    ['Illinois', 'IL'],
    ['Indiana', 'IN'],
    ['Iowa', 'IA'],
    ['Kansas', 'KS'],
    ['Kentucky', 'KY'],
    ['Louisiana', 'LA'],
    ['Maine', 'ME'],
    ['Marshall Islands', 'MH'],
    ['Maryland', 'MD'],
    ['Massachusetts', 'MA'],
    ['Michigan', 'MI'],
    ['Minnesota', 'MN'],
    ['Mississippi', 'MS'],
    ['Missouri', 'MO'],
    ['Montana', 'MT'],
    ['Nebraska', 'NE'],
    ['Nevada', 'NV'],
    ['New Hampshire', 'NH'],
    ['New Jersey', 'NJ'],
    ['New Mexico', 'NM'],
    ['New York', 'NY'],
    ['North Carolina', 'NC'],
    ['North Dakota', 'ND'],
    ['Northern Mariana Islands', 'NP'],
    ['Ohio', 'OH'],
    ['Oklahoma', 'OK'],
    ['Oregon', 'OR'],
    ['Pennsylvania', 'PA'],
    ['Puerto Rico', 'PR'],
    ['Rhode Island', 'RI'],
    ['South Carolina', 'SC'],
    ['South Dakota', 'SD'],
    ['Tennessee', 'TN'],
    ['Texas', 'TX'],
    ['US Virgin Islands', 'VI'],
    ['Utah', 'UT'],
    ['Vermont', 'VT'],
    ['Virginia', 'VA'],
    ['Washington', 'WA'],
    ['West Virginia', 'WV'],
    ['Wisconsin', 'WI'],
    ['Wyoming', 'WY'],
  ];

  // So happy that Canada and the US have distinct abbreviations
  const provinces = [
    ['Alberta', 'AB'],
    ['British Columbia', 'BC'],
    ['Manitoba', 'MB'],
    ['New Brunswick', 'NB'],
    ['Newfoundland', 'NF'],
    ['Northwest Territory', 'NT'],
    ['Nova Scotia', 'NS'],
    ['Nunavut', 'NU'],
    ['Ontario', 'ON'],
    ['Prince Edward Island', 'PE'],
    ['Quebec', 'QC'],
    ['Saskatchewan', 'SK'],
    ['Yukon', 'YT'],
  ];

  const regions = states.concat(provinces);

  let i; // Reusable loop variable
  if (to == 'abbreviated') {
    input = input.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
    for (i = 0; i < regions.length; i++) {
      if (regions[i][0] == input) {
        return (regions[i][1]);
      }
    }
  } else if (to == 'name') {
    input = input.toUpperCase();
    for (i = 0; i < regions.length; i++) {
      if (regions[i][1] == input) {
        return (regions[i][0]);
      }
    }
  }
}


export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rlat1 = lat1 * Math.PI / 180;
  const rlon1 = lon1 * Math.PI / 180;
  const rlat2 = lat2 * Math.PI / 180;
  const rlon2 = lon2 * Math.PI / 180;

  const dlat = Math.sin((rlat2 - rlat1) / 2);
  const dlon = Math.sin((rlon2 - rlon1) / 2);
  const a = Math.min(1, Math.max(0, (dlat * dlat) + (Math.cos(rlat1) * Math.cos(rlat2) * dlon * dlon)));
  const d = 2 * 6371 * Math.asin(Math.sqrt(a));

  return d;
}

export function kmToMiles(km: number): number {
  return km * 0.62137119;
}

// all base58 characters
const BASE58_CHARS = `[a-km-zA-HJ-NP-Z1-9]`;

// all bech32 characters (after the separator)
const BECH32_CHARS_LW = `[ac-hj-np-z02-9]`;
const BECH32_CHARS_UP = `[AC-HJ-NP-Z02-9]`;

// Hex characters
const HEX_CHARS = `[a-fA-F0-9]`;

// A regex to say "A single 0 OR any number with no leading zeroes"
// (?:        // Start a non-capturing group
//   0        // A single 0
//   |        // OR
//   [1-9]\d* // Any succession of numbers starting with 1-9
// )          // End the non-capturing group.
const ZERO_INDEX_NUMBER_CHARS = `(?:0|[1-9]\d*)`;

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
        + `tb1` // Starts with bc1
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
    base58: `[GHPQ]` // G|H is P2PKH, P|Q is P2SH
      + BASE58_CHARS
      + `{33}`, // All min-max lengths are 34
    bech32: `(?:`
        + `(?:` // bech32 liquid starts with ex or lq
          + `ex`
          + `|`
          + `lq`
        + `)`
        + BECH32_CHARS_LW // blech32 and bech32 are the same alphabet and protocol, different checksums.
        + `{6,100}`
      + `|`
        + `(?:` // Same as above but all upper case
          + `EX`
          + `|`
          + `LQ`
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
          + `tex` // TODO: Why does mempool use this and not ert|el like in the elements source?
          + `|`
          + `tlq` // TODO: does this exist?
        + `)`
        + BECH32_CHARS_LW // blech32 and bech32 are the same alphabet and protocol, different checksums.
        + `{6,100}`
      + `|`
        + `(?:` // Same as above but all upper case
          + `TEX`
          + `|`
          + `TLQ`
        + `)`
        + BECH32_CHARS_UP
        + `{6,100}`
      + `)`,
  },
  bisq: {
    base58: `B1` // bisq base58 addrs start with B1
      + BASE58_CHARS
      + `{33}`, // always length 35
    bech32: `(?:`
        + `bbc1` // Starts with bbc1
        + BECH32_CHARS_LW
        + `{6,100}`
      + `|`
        + `BBC1` // All upper case version
        + BECH32_CHARS_UP
        + `{6,100}`
      + `)`,
  },
}
type RegexTypeNoAddr = `blockhash` | `transaction` | `blockheight`;
export type RegexType = `address` | RegexTypeNoAddr;

export const NETWORKS = [`testnet`, `signet`, `liquid`, `liquidtestnet`, `bisq`, `mainnet`] as const;
export type Network = typeof NETWORKS[number]; // Turn const array into union type

export const ADDRESS_REGEXES: [RegExp, Network][] = NETWORKS
  .map(network => [getRegex('address', network), network])

export function getRegex(type: RegexTypeNoAddr): RegExp;
export function getRegex(type: 'address', network: Network): RegExp;
export function getRegex(type: RegexType, network?: Network): RegExp {
  let regex = `^`; // ^ = Start of string
  switch (type) {
    // Match a block height number
    // [Testing Order]: any order is fine
    case `blockheight`:
      regex += ZERO_INDEX_NUMBER_CHARS; // block height is a 0 indexed number
      break;
    // Match a 32 byte block hash in hex. Assumes at least 32 bits of difficulty.
    // [Testing Order]: Must always be tested before `transaction`
    case `blockhash`:
      regex += `0{8}`; // Starts with exactly 8 zeroes in a row
      regex += `${HEX_CHARS}{56}`; // Continues with exactly 56 hex letters/numbers
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
          break;
        case `testnet`:
          regex += ADDRESS_CHARS.testnet.base58;
          regex += `|`; // OR
          regex += ADDRESS_CHARS.testnet.bech32;
          break;
        case `signet`:
          regex += ADDRESS_CHARS.signet.base58;
          regex += `|`; // OR
          regex += ADDRESS_CHARS.signet.bech32;
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
        case `bisq`:
          regex += ADDRESS_CHARS.bisq.base58;
          regex += `|`; // OR
          regex += ADDRESS_CHARS.bisq.bech32;
          break;
        default:
          throw new Error(`Invalid Network ${network} (Unreachable error in TypeScript)`);
      }
      regex += `)`; // End the non-capturing group
      break;
    default:
      throw new Error(`Invalid RegexType ${type} (Unreachable error in TypeScript)`);
  }
  regex += `$`; // $ = End of string
  return new RegExp(regex);
}
