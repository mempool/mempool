const fs = require('fs');

let PROXY_CONFIG = require('./proxy.conf');

PROXY_CONFIG.forEach(entry => {
  entry.target = entry.target.replace("mempool.space", "mempool.ninja");
  entry.target = entry.target.replace("liquid.network", "liquid.place");
  entry.target = entry.target.replace("bisq.markets", "bisq.ninja");
});

module.exports = PROXY_CONFIG;
