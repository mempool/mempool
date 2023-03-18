var https = require('https');
var fs = require('fs');

const CONFIG_FILE_NAME = 'mempool-frontend-config.json';
let configContent = {};

var PATH;
if (process.argv[2]) {
  PATH = process.argv[2];
}

if (!PATH) {
  throw new Error('Resource path argument is not set');
}

try {
  const rawConfig = fs.readFileSync(CONFIG_FILE_NAME);
  configContent = JSON.parse(rawConfig);
  console.log(`${CONFIG_FILE_NAME} file found, using provided config`);
} catch (e) {
  if (e.code !== 'ENOENT') {
    throw new Error(e);
  } else {
    console.log(`${CONFIG_FILE_NAME} file not found, using default config`);
  }
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

function downloadMiningPoolLogos() {
  const options = {
    host: 'api.github.com',
    path: '/repos/mempool/mining-pool-logos/contents/',
    method: 'GET',
    headers: {'user-agent': 'node.js'}
  };

  https.get(options, (response) => {
    let chunks_of_data = [];

    response.on('data', (fragments) => {
      chunks_of_data.push(fragments);
    });

    response.on('end', () => {
      let response_body = Buffer.concat(chunks_of_data);
      try {
        const poolLogos = JSON.parse(response_body.toString());
        for (const poolLogo of poolLogos) {
            download(`${PATH}/mining-pools/${poolLogo.name}`, poolLogo.download_url);
        }
      } catch (e) {
        console.error(`Unable to download mining pool logos. Trying again at next restart. Reason: ${e instanceof Error ? e.message : e}`);
      }
    });

    response.on('error', (error) => {
      throw new Error(error);
    });
  })
}

let assetsJsonUrl = 'https://raw.githubusercontent.com/mempool/asset_registry_db/master/index.json';
let assetsMinimalJsonUrl = 'https://raw.githubusercontent.com/mempool/asset_registry_db/master/index.minimal.json';

if (configContent.BASE_MODULE && configContent.BASE_MODULE === 'liquid') {
  assetsJsonUrl = 'https://raw.githubusercontent.com/Blockstream/asset_registry_db/master/index.json';
  assetsMinimalJsonUrl = 'https://raw.githubusercontent.com/Blockstream/asset_registry_db/master/index.minimal.json';
}

const testnetAssetsJsonUrl = 'https://raw.githubusercontent.com/Blockstream/asset_registry_testnet_db/master/index.json';
const testnetAssetsMinimalJsonUrl = 'https://raw.githubusercontent.com/Blockstream/asset_registry_testnet_db/master/index.minimal.json';

const promoPrefix = PATH + 'promo-video/';
const promoVideoFile = promoPrefix + 'mempool-promo.mp4';
const promoVideoUrl = 'https://raw.githubusercontent.com/mempool/mempool-promo/master/promo.mp4';
const promoVideoLanguages = ['en','sv','ja','zh','cs','fi','fr','de','it','lt','nb','fa','pl','ro','pt'];

console.log('Downloading assets');
download(PATH + 'assets.json', assetsJsonUrl);
console.log('Downloading assets minimal');
download(PATH + 'assets.minimal.json', assetsMinimalJsonUrl);
console.log('Downloading testnet assets');
download(PATH + 'assets-testnet.json', testnetAssetsJsonUrl);
console.log('Downloading testnet assets minimal');
download(PATH + 'assets-testnet.minimal.json', testnetAssetsMinimalJsonUrl);
if (!fs.existsSync(promoVideoFile)) {
  console.log('Downloading promo video');
  download(promoVideoFile, promoVideoUrl);
}
console.log('Downloading promo video subtitles');
for( const l of promoVideoLanguages ) {
  download(promoPrefix + l + ".vtt", "https://raw.githubusercontent.com/mempool/mempool-promo/master/subtitles/" + l + ".vtt");
}
console.log('Downloading mining pool logos');
downloadMiningPoolLogos();
