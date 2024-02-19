import fetch from 'node-fetch-commonjs';
import config from './config';
import http from 'node:http';
import https from 'node:https';

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });
const agentSelector = function(_parsedURL: any) {
    if (_parsedURL.protocol == 'http:') {
        return httpAgent;
    } else {
        return httpsAgent;
    }
}

interface Match {
  render: boolean;
  title: string;
  fallbackImg: string;
  fallbackFile: string;
  staticImg?: string;
  networkMode: string;
  params?: string[];
  sip?: SipTemplate;
}

interface SipTemplate {
  template: string;
  getData: Function;
}

async function sipFetchJSON(url, defaultVal = null) {
  try {
    const response = await fetch(url, { agent: agentSelector });
    return response.ok ? response.json() : defaultVal;
  } catch (error) {
    return defaultVal;
  }
}

const routes = {
  block: {
    render: true,
    params: 1,
    getTitle(path) {
      return `Block: ${path[0]}`;
    },
    sip: {
      template: 'block',
      async getData (params: string[]) {
        if (params?.length) {
          let blockId = params[0];
          if (blockId.length !== 64) {
            blockId = await (await fetch(config.API.ESPLORA + `/block-height/${blockId}`, { agent: agentSelector })).text();
          }
          const [block, transactions] = await Promise.all([
            sipFetchJSON(config.API.MEMPOOL + `/block/${blockId}`),
            sipFetchJSON(config.API.ESPLORA + `/block/${blockId}/txids`),
          ])
          return {
            block,
            transactions,
            canonicalPath: `/block/${blockId}`,
          };
        }
      }
    }
  },
  address: {
    render: true,
    params: 1,
    getTitle(path) {
      return `Address: ${path[0]}`;
    }
  },
  tx: {
    render: true,
    params: 1,
    getTitle(path) {
      return `Transaction: ${path[0]}`;
    },
    sip: {
      template: 'tx',
      async getData (params: string[]) {
        if (params?.length) {
          let txid = params[0];
          const [transaction, times, cpfp, rbf, outspends]: any[] = await Promise.all([
            sipFetchJSON(config.API.ESPLORA + `/tx/${txid}`),
            sipFetchJSON(config.API.MEMPOOL + `/transaction-times?txId[]=${txid}`),
            sipFetchJSON(config.API.MEMPOOL + `/cpfp/${txid}`),
            sipFetchJSON(config.API.MEMPOOL + `/tx/${txid}/rbf`),
            sipFetchJSON(config.API.MEMPOOL + `/outspends?txId[]=${txid}`),
          ])
          const features = transaction ? {
            segwit: transaction.vin.some((v) => v.prevout && ['v0_p2wsh', 'v0_p2wpkh'].includes(v.prevout.scriptpubkey_type)),
            taproot: transaction.vin.some((v) => v.prevout && v.prevout.scriptpubkey_type === 'v1_p2tr'),
            rbf: transaction.vin.some((v) => v.sequence < 0xfffffffe),
          } : {};
          return {
            transaction,
            times,
            cpfp,
            rbf,
            outspends,
            features,
            hex2ascii: function(hex) {
              const opPush = hex.split(' ').filter((_, i, a) => i > 0 && /^OP_PUSH/.test(a[i - 1]));
              if (opPush[0]) {
                hex = opPush[0];
              }
              if (!hex) {
                return '';
              }
              const bytes: number[] = [];
              for (let i = 0; i < hex.length; i += 2) {
                bytes.push(parseInt(hex.substr(i, 2), 16));
              }
              return new TextDecoder('utf8').decode(Uint8Array.from(bytes)).replace(/\uFFFD/g, '').replace(/\\0/g, '');
            },
          }
        }
      }
    }
  },
  lightning: {
    title: "Lightning",
    fallbackImg: '/resources/previews/lightning.png',
    fallbackFile: '/resources/img/lightning.png',
    routes: {
      node: {
        render: true,
        params: 1,
        getTitle(path) {
          return `Lightning Node: ${path[0]}`;
        }
      },
      channel: {
        render: true,
        params: 1,
        getTitle(path) {
          return `Lightning Channel: ${path[0]}`;
        }
      },
      nodes: {
        routes: {
          isp: {
            render: true,
            params: 1,
            getTitle(path) {
              return `Lightning ISP: ${path[0]}`;
            }
          }
        }
      },
      group: {
        render: true,
        params: 1,
        getTitle(path) {
          return `Lightning Node Group: ${path[0]}`;
        }
      }
    }
  },
  mining: {
    title: "Mining",
    fallbackImg: '/resources/previews/mining.png',
    fallbackFile: '/resources/img/mining.png',
    routes: {
      pool: {
        render: true,
        params: 1,
        getTitle(path) {
          return `Mining Pool: ${path[0]}`;
        }
      }
    }
  }
};

const networks = {
  bitcoin: {
    fallbackImg: '/resources/previews/dashboard.png',
    fallbackFile: '/resources/img/dashboard.png',
    routes: {
      ...routes // all routes supported
    }
  },
  liquid: {
    fallbackImg: '/resources/liquid/liquid-network-preview.png',
    fallbackFile: '/resources/img/liquid',
    routes: { // only block, address & tx routes supported
      block: routes.block,
      address: routes.address,
      tx: routes.tx
    }
  },
  bisq: {
    fallbackImg: '/resources/bisq/bisq-markets-preview.png',
    fallbackFile: '/resources/img/bisq.png',
    routes: {} // no routes supported
  }
};

export function matchRoute(network: string, path: string, matchFor: string = 'render'): Match {
  const match: Match = {
    render: false,
    title: '',
    fallbackImg: '',
    fallbackFile: '',
    networkMode: 'mainnet'
  }

  const parts = path.slice(1).split('/').filter(p => p.length);

  if (parts[0] === 'preview') {
    parts.shift();
  }
  if (['testnet', 'signet'].includes(parts[0])) {
    match.networkMode = parts.shift() || 'mainnet';
  }

  let route = networks[network] || networks.bitcoin;
  match.fallbackImg = route.fallbackImg;
  match.fallbackFile = route.fallbackFile;

  // traverse the route tree until we run out of route or tree, or hit a renderable match
  while (!route[matchFor] && route.routes && parts.length && route.routes[parts[0]]) {
    route = route.routes[parts[0]];
    parts.shift();
    if (route.fallbackImg) {
      match.fallbackImg = route.fallbackImg;
      match.fallbackFile = route.fallbackFile;
    }
  }

  // enough route parts left for title & rendering
  if (route[matchFor] && parts.length >= route.params) {
    match.render = route.render;
    match.sip = route.sip;
    match.params = parts;
  }
  // only use set a static image for exact matches
  if (!parts.length && route.staticImg) {
    match.staticImg = route.staticImg;
  }
  // apply the title function if present
  if (route.getTitle && typeof route.getTitle === 'function') {
    match.title = route.getTitle(parts);
  } else {
    match.title = route.title;
  }

  return match;
}