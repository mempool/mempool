interface Match {
  render: boolean;
  title: string;
  fallbackImg: string;
  staticImg?: string;
  networkMode: string;
}

const routes = {
  block: {
    render: true,
    params: 1,
    getTitle(path) {
      return `Block: ${path[0]}`;
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
    }
  },
  lightning: {
    title: "Lightning",
    fallbackImg: '/resources/previews/lightning.png',
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
      }
    }
  },
  mining: {
    title: "Mining",
    fallbackImg: '/resources/previews/mining.png'
  }
};

const networks = {
  bitcoin: {
    fallbackImg: '/resources/previews/dashboard.png',
    routes: {
      ...routes // all routes supported
    }
  },
  liquid: {
    fallbackImg: '/resources/liquid/liquid-network-preview.png',
    routes: { // only block, address & tx routes supported
      block: routes.block,
      address: routes.address,
      tx: routes.tx
    }
  },
  bisq: {
    fallbackImg: '/resources/bisq/bisq-markets-preview.png',
    routes: {} // no routes supported
  }
};

export function matchRoute(network: string, path: string): Match {
  const match: Match = {
    render: false,
    title: '',
    fallbackImg: '',
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

  // traverse the route tree until we run out of route or tree, or hit a renderable match
  while (!route.render && route.routes && parts.length && route.routes[parts[0]]) {
    route = route.routes[parts[0]];
    parts.shift();
    if (route.fallbackImg) {
      match.fallbackImg = route.fallbackImg;
    }
  }

  // enough route parts left for title & rendering
  if (route.render && parts.length >= route.params) {
    match.render = true;
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