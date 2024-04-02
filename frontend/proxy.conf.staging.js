const fs = require('fs');

let PROXY_CONFIG = require('./proxy.conf');

PROXY_CONFIG.forEach(entry => {
  entry.target = entry.target.replace("mempool.space", "mempool-staging.fra.mempool.space");
  entry.target = entry.target.replace("liquid.network", "liquid-staging.fra.mempool.space");
});

module.exports = PROXY_CONFIG;
