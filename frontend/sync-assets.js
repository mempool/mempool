var https = require('https');
var fs = require('fs');
var crypto = require('crypto');

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

function getLocalHash(filePath) {
  const size = fs.statSync(filePath);
  const buffer = fs.readFileSync(filePath);
  const bufferWithHeader = Buffer.concat([Buffer.from('blob '), Buffer.from(`${size.size}`), Buffer.from('\0'), buffer]);
  return crypto.createHash('sha1').update(bufferWithHeader).digest('hex');
}

function downloadMiningPoolLogos() {
  const options = {
    host: 'api.github.com',
    path: '/repos/mempool/mining-pool-logos/contents/',
    method: 'GET',
    headers: {'user-agent': 'node.js'}
  };

  https.get(options, (response) => {
    const chunks_of_data = [];

    response.on('data', (fragments) => {
      chunks_of_data.push(fragments);
    });

    response.on('end', () => {
      const response_body = Buffer.concat(chunks_of_data);
      try {
        const poolLogos = JSON.parse(response_body.toString());
        let downloadedCount = 0;
        for (const poolLogo of poolLogos) {
          const filePath = `${PATH}/mining-pools/${poolLogo.name}`;
          if (fs.existsSync(filePath)) {
            const localHash = getLocalHash(filePath);
            if (localHash !== poolLogo.sha) {
              console.log(`${poolLogo.name} is different on the remote, updating`);
              download(filePath, poolLogo.download_url);
              downloadedCount++;
            }
          } else {
            console.log(`${poolLogo.name} is missing, downloading`);
            download(`${PATH}mining-pools/${poolLogo.name}`, poolLogo.download_url);
            downloadedCount++;
          }
        }
        console.log(`Downloaded ${downloadedCount} and skipped ${poolLogos.length - downloadedCount} existing mining pool logos`);
      } catch (e) {
        console.error(`Unable to download mining pool logos. Trying again at next restart. Reason: ${e instanceof Error ? e.message : e}`);
      }
    });

    response.on('error', (error) => {
      throw new Error(error);
    });
  });
}

function downloadPromoVideoSubtiles() {
  const options = {
    host: 'api.github.com',
    path: '/repos/mempool/mempool-promo/contents/subtitles',
    method: 'GET',
    headers: {'user-agent': 'node.js'}
  };

  https.get(options, (response) => {
    const chunks_of_data = [];

    response.on('data', (fragments) => {
      chunks_of_data.push(fragments);
    });

    response.on('end', () => {
      const response_body = Buffer.concat(chunks_of_data);
      try {
        const videoLanguages = JSON.parse(response_body.toString());
        let downloadedCount = 0;
        for (const language of videoLanguages) {
          const filePath = `${PATH}/promo-video/${language.name}`;
          if (fs.existsSync(filePath)) {
            const localHash = getLocalHash(filePath);
            if (localHash !== language.sha) {
              console.log(`${language.name} is different on the remote, updating`);
              download(filePath, language.download_url);
              downloadedCount++;
            }
          } else {
            console.log(`${language.name} is missing, downloading`);
            download(filePath, language.download_url);
            downloadedCount++;
          }
        }
        console.log(`Downloaded ${downloadedCount} and skipped ${videoLanguages.length - downloadedCount} existing video subtitles`);
      } catch (e) {
        console.error(`Unable to download video subtitles. Trying again at next restart. Reason: ${e instanceof Error ? e.message : e}`);
      }
    });

    response.on('error', (error) => {
      throw new Error(error);
    });
  });
}

let assetsJsonUrl = 'https://raw.githubusercontent.com/mempool/asset_registry_db/master/index.json';
let assetsMinimalJsonUrl = 'https://raw.githubusercontent.com/mempool/asset_registry_db/master/index.minimal.json';

if (configContent.BASE_MODULE && configContent.BASE_MODULE === 'liquid') {
  assetsJsonUrl = 'https://raw.githubusercontent.com/Blockstream/asset_registry_db/master/index.json';
  assetsMinimalJsonUrl = 'https://raw.githubusercontent.com/Blockstream/asset_registry_db/master/index.minimal.json';
}

const testnetAssetsJsonUrl = 'https://raw.githubusercontent.com/Blockstream/asset_registry_testnet_db/master/index.json';
const testnetAssetsMinimalJsonUrl = 'https://raw.githubusercontent.com/Blockstream/asset_registry_testnet_db/master/index.minimal.json';


const promoVideoFile = PATH + '/promo-video/mempool-promo.mp4';
const promoVideoUrl = 'https://raw.githubusercontent.com/mempool/mempool-promo/master/promo.mp4';

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
downloadPromoVideoSubtiles();
console.log('Downloading mining pool logos');
downloadMiningPoolLogos();
