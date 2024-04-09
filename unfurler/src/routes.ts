interface Match {
  render: boolean;
  title: string;
  fallbackImg: string;
  staticImg?: string;
  networkMode: string;
}

const routes = {
  about: {
    title: "About",
    fallbackImg: '/resources/previews/about.jpg',
  },
  acceleration: {
    title: "Acceleration",
    fallbackImg: '/resources/previews/accelerator.jpg',
  },
  accelerator: {
    title: "Mempool Accelerator",
    fallbackImg: '/resources/previews/accelerator.jpg',
  },
  address: {
    render: true,
    params: 1,
    getTitle(path) {
      return `Address: ${path[0]}`;
    }
  },
  block: {
    render: true,
    params: 1,
    getTitle(path) {
      return `Block: ${path[0]}`;
    }
  },
  blocks: {
    title: "Blocks",
    fallbackImg: '/resources/previews/blocks.jpg',
  },
  docs: {
    title: "Docs",
    fallbackImg: '/resources/previews/faq.jpg',
    routes: {
      faq: {
        title: "FAQ",
        fallbackImg: '/resources/previews/faq.jpg',
      },
      api: {
        title: "API Docs",
        fallbackImg: '/resources/previews/docs-api.jpg',
      }
    }
  },
  enterprise: {
    title: "Mempool Enterprise",
    fallbackImg: '/resources/previews/enterprise.jpg',
  },
  lightning: {
    title: "Lightning",
    fallbackImg: '/resources/previews/lightning.jpg',
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
    fallbackImg: '/resources/previews/mining.jpg',
    routes: {
      pool: {
        render: true,
        params: 1,
        getTitle(path) {
          return `Mining Pool: ${path[0]}`;
        }
      }
    }
  },
  "privacy-policy": {
    title: "Privacy Policy",
    fallbackImg: '/resources/previews/privacy-policy.jpg',
  },
  rbf: {
    title: "RBF",
    fallbackImg: '/resources/previews/rbf.jpg',
  },
  sponsor: {
    title: "Community Sponsors",
    fallbackImg: '/resources/previews/sponsor.jpg',
  },
  "terms-of-service": {
    title: "Terms of Service",
    fallbackImg: '/resources/previews/terms-of-service.jpg',
  },
  "trademark-policy": {
    title: "Trademark Policy",
    fallbackImg: '/resources/previews/trademark-policy.jpg',
  },
  tx: {
    render: true,
    params: 1,
    getTitle(path) {
      return `Transaction: ${path[0]}`;
    },
    routes: {
      push: {
        title: "Push Transaction",
        fallbackImg: '/resources/previews/tx-push.jpg',
      }
    }
  }
};

const networks = {
  bitcoin: {
    fallbackImg: '/resources/previews/mempool-space-preview.jpg',
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
  while (route.routes && parts.length && route.routes[parts[0]]) {
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
