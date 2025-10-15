import { MempoolBlockDelta, MempoolBlockDeltaCompressed, MempoolDeltaChange, TransactionCompressed } from "../interfaces/websocket.interface";
import { TransactionStripped } from "@interfaces/node-api.interface";
import { AmountShortenerPipe } from "@app/shared/pipes/amount-shortener.pipe";
import { Router, ActivatedRoute } from '@angular/router';
const amountShortenerPipe = new AmountShortenerPipe();
import { isDevMode } from '@angular/core';

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
  } else if( network === 'signet' || network === 'testnet' || network === 'testnet4') {
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
    time: tx[6],
    acc: !!tx[7],
  };
}

export function uncompressDeltaChange(block: number, delta: MempoolBlockDeltaCompressed): MempoolBlockDelta {
  return {
    block,
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

export function renderSats(value: number, network: string, mode: 'sats' | 'btc' | 'auto' = 'auto'): string {
  let prefix = '';
  switch (network) {
    case 'liquid':
      prefix = 'L';
      break;
    case 'liquidtestnet':
      prefix = 'tL';
      break;
    case 'testnet':
    case 'testnet4':
      prefix = 't';
      break;
    case 'signet':
      prefix = 's';
      break;
  }
  if (mode === 'btc' || (mode === 'auto' && value >= 1000000)) {
    return `${amountShortenerPipe.transform(value / 100000000, 2)} ${prefix}BTC`;
  } else {
    if (prefix.length) {
      prefix += '-';
    }
    return `${amountShortenerPipe.transform(value, 2)} ${prefix}sats`;
  }
}

export function sleep$(ms: number): Promise<void> {
  return new Promise((resolve) => {
     setTimeout(() => {
       resolve();
     }, ms);
  });
}

export function handleDemoRedirect(route: ActivatedRoute, router: Router) {
  route.queryParams
    .subscribe(params => {
      if (params.next) {
        const path = ['/', '/acceleration', '/mining', '/lightning'];
        const index = path.indexOf(params.next);
        if (index >= 0) {
          const nextPath = path[(index + 1) % path.length];
          setTimeout(() => { window.location.replace(`${params.next}?next=${nextPath}`) }, 15000);
        }
      }
    }
  );
}

// https://stackoverflow.com/a/60467595
export function md5(inputString): string {
    var hc="0123456789abcdef";
    function rh(n) {var j,s="";for(j=0;j<=3;j++) s+=hc.charAt((n>>(j*8+4))&0x0F)+hc.charAt((n>>(j*8))&0x0F);return s;}
    function ad(x,y) {var l=(x&0xFFFF)+(y&0xFFFF);var m=(x>>16)+(y>>16)+(l>>16);return (m<<16)|(l&0xFFFF);}
    function rl(n,c)            {return (n<<c)|(n>>>(32-c));}
    function cm(q,a,b,x,s,t)    {return ad(rl(ad(ad(a,q),ad(x,t)),s),b);}
    function ff(a,b,c,d,x,s,t)  {return cm((b&c)|((~b)&d),a,b,x,s,t);}
    function gg(a,b,c,d,x,s,t)  {return cm((b&d)|(c&(~d)),a,b,x,s,t);}
    function hh(a,b,c,d,x,s,t)  {return cm(b^c^d,a,b,x,s,t);}
    function ii(a,b,c,d,x,s,t)  {return cm(c^(b|(~d)),a,b,x,s,t);}
    function sb(x) {
        var i;var nblk=((x.length+8)>>6)+1;var blks=new Array(nblk*16);for(i=0;i<nblk*16;i++) blks[i]=0;
        for(i=0;i<x.length;i++) blks[i>>2]|=x.charCodeAt(i)<<((i%4)*8);
        blks[i>>2]|=0x80<<((i%4)*8);blks[nblk*16-2]=x.length*8;return blks;
    }
    var i,x=sb(""+inputString),a=1732584193,b=-271733879,c=-1732584194,d=271733878,olda,oldb,oldc,oldd;
    for(i=0;i<x.length;i+=16) {olda=a;oldb=b;oldc=c;oldd=d;
        a=ff(a,b,c,d,x[i+ 0], 7, -680876936);d=ff(d,a,b,c,x[i+ 1],12, -389564586);c=ff(c,d,a,b,x[i+ 2],17,  606105819);
        b=ff(b,c,d,a,x[i+ 3],22,-1044525330);a=ff(a,b,c,d,x[i+ 4], 7, -176418897);d=ff(d,a,b,c,x[i+ 5],12, 1200080426);
        c=ff(c,d,a,b,x[i+ 6],17,-1473231341);b=ff(b,c,d,a,x[i+ 7],22,  -45705983);a=ff(a,b,c,d,x[i+ 8], 7, 1770035416);
        d=ff(d,a,b,c,x[i+ 9],12,-1958414417);c=ff(c,d,a,b,x[i+10],17,     -42063);b=ff(b,c,d,a,x[i+11],22,-1990404162);
        a=ff(a,b,c,d,x[i+12], 7, 1804603682);d=ff(d,a,b,c,x[i+13],12,  -40341101);c=ff(c,d,a,b,x[i+14],17,-1502002290);
        b=ff(b,c,d,a,x[i+15],22, 1236535329);a=gg(a,b,c,d,x[i+ 1], 5, -165796510);d=gg(d,a,b,c,x[i+ 6], 9,-1069501632);
        c=gg(c,d,a,b,x[i+11],14,  643717713);b=gg(b,c,d,a,x[i+ 0],20, -373897302);a=gg(a,b,c,d,x[i+ 5], 5, -701558691);
        d=gg(d,a,b,c,x[i+10], 9,   38016083);c=gg(c,d,a,b,x[i+15],14, -660478335);b=gg(b,c,d,a,x[i+ 4],20, -405537848);
        a=gg(a,b,c,d,x[i+ 9], 5,  568446438);d=gg(d,a,b,c,x[i+14], 9,-1019803690);c=gg(c,d,a,b,x[i+ 3],14, -187363961);
        b=gg(b,c,d,a,x[i+ 8],20, 1163531501);a=gg(a,b,c,d,x[i+13], 5,-1444681467);d=gg(d,a,b,c,x[i+ 2], 9,  -51403784);
        c=gg(c,d,a,b,x[i+ 7],14, 1735328473);b=gg(b,c,d,a,x[i+12],20,-1926607734);a=hh(a,b,c,d,x[i+ 5], 4,    -378558);
        d=hh(d,a,b,c,x[i+ 8],11,-2022574463);c=hh(c,d,a,b,x[i+11],16, 1839030562);b=hh(b,c,d,a,x[i+14],23,  -35309556);
        a=hh(a,b,c,d,x[i+ 1], 4,-1530992060);d=hh(d,a,b,c,x[i+ 4],11, 1272893353);c=hh(c,d,a,b,x[i+ 7],16, -155497632);
        b=hh(b,c,d,a,x[i+10],23,-1094730640);a=hh(a,b,c,d,x[i+13], 4,  681279174);d=hh(d,a,b,c,x[i+ 0],11, -358537222);
        c=hh(c,d,a,b,x[i+ 3],16, -722521979);b=hh(b,c,d,a,x[i+ 6],23,   76029189);a=hh(a,b,c,d,x[i+ 9], 4, -640364487);
        d=hh(d,a,b,c,x[i+12],11, -421815835);c=hh(c,d,a,b,x[i+15],16,  530742520);b=hh(b,c,d,a,x[i+ 2],23, -995338651);
        a=ii(a,b,c,d,x[i+ 0], 6, -198630844);d=ii(d,a,b,c,x[i+ 7],10, 1126891415);c=ii(c,d,a,b,x[i+14],15,-1416354905);
        b=ii(b,c,d,a,x[i+ 5],21,  -57434055);a=ii(a,b,c,d,x[i+12], 6, 1700485571);d=ii(d,a,b,c,x[i+ 3],10,-1894986606);
        c=ii(c,d,a,b,x[i+10],15,   -1051523);b=ii(b,c,d,a,x[i+ 1],21,-2054922799);a=ii(a,b,c,d,x[i+ 8], 6, 1873313359);
        d=ii(d,a,b,c,x[i+15],10,  -30611744);c=ii(c,d,a,b,x[i+ 6],15,-1560198380);b=ii(b,c,d,a,x[i+13],21, 1309151649);
        a=ii(a,b,c,d,x[i+ 4], 6, -145523070);d=ii(d,a,b,c,x[i+11],10,-1120210379);c=ii(c,d,a,b,x[i+ 2],15,  718787259);
        b=ii(b,c,d,a,x[i+ 9],21, -343485551);a=ad(a,olda);b=ad(b,oldb);c=ad(c,oldc);d=ad(d,oldd);
    }
    return rh(a)+rh(b)+rh(c)+rh(d);
}

export function injectSquare(isProdDomain): void {
    if (!isProdDomain && !isDevMode()) {
      return;
    }
    if (window['Square']) {
      return;
    }
    let statsUrl = 'https://sandbox.web.squarecdn.com/v1/square.js';
    if (isProdDomain) {
      statsUrl = '/square/v1/square.js';
    }

    (function(): void {
      const d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
      g.type='text/javascript'; g.src=statsUrl; s.parentNode.insertBefore(g, s);
    })();
}
