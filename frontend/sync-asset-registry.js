var https = require('https');
var fs = require('fs');

var PATH = 'dist/mempool/resources/';
if (process.argv[2] && process.argv[2] === 'dev') {
  PATH = 'src/resources/';
}

function download(filename, url) {
  var file = fs.createWriteStream(filename);
  https.get(url, function(response) {
    response.pipe(file);
  });
}

console.log('Downloading assets');
download(PATH + 'assets.json', 'https://raw.githubusercontent.com/Blockstream/asset_registry_db/master/index.json');
console.log('Downloading assets minimal');
download(PATH + 'assets.minimal.json', 'https://raw.githubusercontent.com/Blockstream/asset_registry_db/master/index.minimal.json');
