const fs = require('fs');

let PROXY_CONFIG = require('./proxy.conf');

PROXY_CONFIG.forEach(entry => {
  entry.target = entry.target.replace("mempool.space", "node201.fmt.mempool.space");
  entry.target = entry.target.replace("liquid.network", "liquid-staging.fmt.mempool.space");
});

module.exports = PROXY_CONFIG;
