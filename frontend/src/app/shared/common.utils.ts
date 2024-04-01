import { MempoolBlockDelta, MempoolBlockDeltaCompressed, MempoolDeltaChange, TransactionCompressed, TransactionStripped } from "../interfaces/websocket.interface";

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

const roundNumbers = [1, 2, 5, 10, 15, 20, 25, 50, 75, 100, 125, 150, 175, 200, 250, 300, 350, 400, 450, 500, 600, 700, 750, 800, 900, 1000];
export function nextRoundNumber(num: number): number {
  const log = Math.floor(Math.log10(num));
  const factor = log >= 3 ? Math.pow(10, log - 2) : 1;
  num /= factor;
  return factor * (roundNumbers.find(val => val >= num) || roundNumbers[roundNumbers.length - 1]);
}

export function seoDescriptionNetwork(network: string): string {
  if( network === 'liquidtestnet' || network === 'testnet' ) {
    return ' Testnet';
  } else if( network === 'signet' || network === 'testnet' ) {
    return ' ' + network.charAt(0).toUpperCase() + network.slice(1);
  }
  return '';
}

export function uncompressTx(tx: TransactionCompressed): TransactionStripped {
  return {
    txid: tx[0],
    fee: tx[1],
    vsize: tx[2],
    value: tx[3],
    rate: tx[4],
    flags: tx[5],
    acc: !!tx[6],
  };
}

export function uncompressDeltaChange(delta: MempoolBlockDeltaCompressed): MempoolBlockDelta {
  return {
    added: delta.added.map(uncompressTx),
    removed: delta.removed,
    changed: delta.changed.map(tx => ({
      txid: tx[0],
      rate: tx[1],
      flags: tx[2],
      acc: !!tx[3],
    }))
  };
}