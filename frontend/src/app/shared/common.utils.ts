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
const BASE58_CHARS = '[a-km-zA-HJ-NP-Z1-9]';
// all bech32 characters (after the separator)
const BECH32_CHARS = '[ac-hj-np-z02-9]';
// All characters usable in bech32 human readable portion (before the 1 separator)
// Note: Technically the spec says "all US ASCII characters" but in practice only alphabet is used.
// Note: If HRP contains the separator (1) then the separator is "the last instance of separator"
const BECH32_HRP_CHARS = '[a-zA-Z0-9]';
// Hex characters
const HEX_CHARS = '[a-fA-F0-9]';
// A regex to say "A single 0 OR any number with no leading zeroes"
// (?:            // Start a non-capturing group
//   0            // A single 0
//   |            // OR
//   [1-9][0-9]*  // Any succession of numbers starting with 1-9
// )              // End the non-capturing group.
const ZERO_INDEX_NUMBER_CHARS = '(?:0|[1-9][0-9]*)';
export type RegexType = 'address' | 'blockhash' | 'transaction' | 'blockheight';
export type Network = 'testnet' | 'signet' | 'liquid' | 'bisq' | 'mainnet';
export function getRegex(type: RegexType, network: Network): RegExp {
  let regex = '^'; // ^ = Start of string
  switch (type) {
    // Match a block height number
    // [Testing Order]: any order is fine
    case 'blockheight':
      regex += ZERO_INDEX_NUMBER_CHARS; // block height is a 0 indexed number
      break;
    // Match a 32 byte block hash in hex. Assumes at least 32 bits of difficulty.
    // [Testing Order]: Must always be tested before 'transaction'
    case 'blockhash':
      regex += '0{8}'; // Starts with exactly 8 zeroes in a row
      regex += `${HEX_CHARS}{56}`; // Continues with exactly 56 hex letters/numbers
      break;
    // Match a 32 byte tx hash in hex. Contains optional output index specifier.
    // [Testing Order]: Must always be tested after 'blockhash'
    case 'transaction':
      regex += `${HEX_CHARS}{64}`; // Exactly 64 hex letters/numbers
      regex += '(?:'; // Start a non-capturing group
      regex += ':'; // 1 instances of the symbol ":"
      regex += ZERO_INDEX_NUMBER_CHARS; // A zero indexed number
      regex += ')?'; // End the non-capturing group. This group appears 0 or 1 times
      break;
    case 'address':
      // TODO
      switch (network) {
        case 'mainnet':
          break;
        case 'testnet':
          break;
        case 'signet':
          break;
        case 'liquid':
          break;
        case 'bisq':
          break;
        default:
          throw new Error('Invalid Network (Unreachable error in TypeScript)');
      }
      break;
    default:
      throw new Error('Invalid RegexType (Unreachable error in TypeScript)');
  }
  regex += '$'; // $ = End of string
  return new RegExp(regex);
}
