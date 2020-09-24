var https = require('https');
var fs = require('fs');

var PATH = 'dist/mempool/resources/';
if (process.argv[2] && process.argv[2] === 'dev') {
  PATH = 'src/resources/';
}

function download(filename, url) {
  https.get(url, (response) => {
    if (response.statusCode < 200 || response.statusCode > 299) {
      throw new Error('HTTP Error ' + response.statusCode + ' while fetching \'' + filename + '\'');
    }
    response.pipe(fs.createWriteStream(filename));
  })
  .on('error', function(e) {
    throw new Error(e);
  });
}

console.log('Downloading assets');
download(PATH + 'assets.json', 'https://raw.githubusercontent.com/mempool/asset_registry_db/master/index.json');
console.log('Downloading assets minimal');
download(PATH + 'assets.minimal.json', 'https://raw.githubusercontent.com/mempool/asset_registry_db/master/index.minimal.json');
console.log('Downloading mining pools info');
download(PATH + 'pools.json', 'https://raw.githubusercontent.com/btccom/Blockchain-Known-Pools/master/pools.json');