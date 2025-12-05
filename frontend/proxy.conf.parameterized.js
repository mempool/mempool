const PROXY_CONFIG = require('./proxy.conf');

const addApiKeyHeader = (proxyReq) => {
  if (process.env.MEMPOOL_CI_API_KEY) {
    proxyReq.setHeader('X-Mempool-Auth', process.env.MEMPOOL_CI_API_KEY);
  }
};

PROXY_CONFIG.forEach((entry) => {
  const mempoolHostname = process.env.MEMPOOL_HOSTNAME
    ? process.env.MEMPOOL_HOSTNAME
    : 'mempool.space';

  const liquidHostname = process.env.LIQUID_HOSTNAME
    ? process.env.LIQUID_HOSTNAME
    : 'liquid.network';

  entry.target = entry.target.replace('mempool.space', mempoolHostname);
  entry.target = entry.target.replace('liquid.network', liquidHostname);

  if (entry.onProxyReq) {
    const originalProxyReq = entry.onProxyReq;
    entry.onProxyReq = (proxyReq, req, res) => {
      originalProxyReq(proxyReq, req, res);
      if (process.env.MEMPOOL_CI_API_KEY) {
        proxyReq.setHeader('X-Mempool-Auth', process.env.MEMPOOL_CI_API_KEY);
      }
    };
  } else {
    entry.onProxyReq = addApiKeyHeader;
  }
});

module.exports = PROXY_CONFIG;
