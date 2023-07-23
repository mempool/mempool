let https = require('https');
let fs = require('fs');
let crypto = require('crypto');
let { resolve } = require('path');

const CONFIG_FILE_NAME = 'mempool-frontend-config.json';
let configContent = {};

const LOG_TAG = '[sync-assets]';
let  PATH;
if (process.argv[2]) {
  PATH = resolve(process.argv[2]);
  if (!fs.existsSync(PATH)) {
    console.log(`PATH ${PATH} does not exist`);
    process.exit(-1);
  }
  console.log(`${LOG_TAG} PATH ${PATH}`);
}

if (!PATH) {
  throw new Error('Resource path argument is not set');
}

try {
  const rawConfig = fs.readFileSync(CONFIG_FILE_NAME);
  configContent = JSON.parse(rawConfig);
  console.log(`${LOG_TAG} ${CONFIG_FILE_NAME} file found, using provided config`);
} catch (e) {
  if (e.code !== 'ENOENT') {
    throw new Error(e);
  } else {
    console.log(`${LOG_TAG} ${CONFIG_FILE_NAME} file not found, using default config`);
  }
}

const githubSecret = process.env.GITHUB_TOKEN;

function download(filename, url) {
  console.log(`${LOG_TAG} download ${filename}`);
  https.get(url, (response) => {
    if (response.statusCode < 200 || response.statusCode > 299) {
      throw new Error('HTTP Error ' + response.statusCode + ' while fetching \'' + filename + '\'');
    }
    response.pipe(fs.createWriteStream(filename));
  })
  .on('error', function(e) {
    throw new Error(e);
  })
  .on('finish', () => {
    console.log(`${LOG_TAG} finished downloading ${url} to ${filename}`);
  })
}

function getLocalHash(filePath) {
  console.log(`${LOG_TAG} getLocalHash ${filePath}`);
  const size = fs.statSync(filePath);
  const buffer = fs.readFileSync(filePath);
  const bufferWithHeader = Buffer.concat([Buffer.from('blob '), Buffer.from(`${size.size}`), Buffer.from('\0'), buffer]);
  const hash = crypto.createHash('sha1').update(bufferWithHeader).digest('hex');
  console.log(`${LOG_TAG} getLocalHash ${filePath} ${hash}`);
  return hash;
}

function downloadMiningPoolLogos$() {
  return new Promise((resolve, reject) => {
    console.log(`${LOG_TAG} Checking if mining pool logos needs downloading or updating...`);
    const options = {
      host: 'api.github.com',
      path: '/repos/mempool/mining-pool-logos/contents/',
      method: 'GET',
      headers: {'user-agent': 'node.js'}
    };

    if (githubSecret) {
      console.log(`${LOG_TAG} Downloading the mining pool logos with authentication`);
      options.headers['authorization'] = `Bearer ${githubSecret}`;
      options.headers['X-GitHub-Api-Version'] = '2022-11-28';
    }

    https.get(options, (response) => {
      const chunks_of_data = [];

      response.on('data', (fragments) => {
        chunks_of_data.push(fragments);
      });

      response.on('end', () => {
        const response_body = Buffer.concat(chunks_of_data);
        try {
          const poolLogos = JSON.parse(response_body.toString());
          if (poolLogos.message) {
            reject(poolLogos.message);
          }
          let downloadedCount = 0;
          for (const poolLogo of poolLogos) {
            const filePath = `${PATH}/mining-pools/${poolLogo.name}`;
            console.log(`${LOG_TAG} remote logo hash ${poolLogo.sha}`);
            console.log(`${LOG_TAG} checking if ${filePath} exists: ${fs.existsSync(filePath)}`);
            if (fs.existsSync(filePath)) {
              const localHash = getLocalHash(filePath);
              if (localHash !== poolLogo.sha) {
                console.log(`${poolLogo.name} is different on the remote, downloading...`);
                download(filePath, poolLogo.download_url);
                downloadedCount++;
              }
            } else {
              console.log(`${poolLogo.name} is missing, downloading...`);
              download(filePath, poolLogo.download_url);
              downloadedCount++;
            }
          }
          console.log(`${LOG_TAG} Downloaded ${downloadedCount} and skipped ${poolLogos.length - downloadedCount} existing mining pool logos`);
          resolve();
        } catch (e) {
          reject(`Unable to download mining pool logos. Trying again at next restart. Reason: ${e instanceof Error ? e.message : e}`);
        }
      });

      response.on('error', (error) => {
        reject(error);
      });
    });
  });
}

function downloadPromoVideoSubtiles$() {
  return new Promise((resolve, reject) => {
    console.log(`${LOG_TAG} Checking if promo video subtitles needs downloading or updating...`);
    const options = {
      host: 'api.github.com',
      path: '/repos/mempool/mempool-promo/contents/subtitles',
      method: 'GET',
      headers: {'user-agent': 'node.js'}
    };

    if (githubSecret) {
      console.log(`${LOG_TAG} Downloading the promo video subtitles with authentication`);
      options.headers['authorization'] = `Bearer ${githubSecret}`;
      options.headers['X-GitHub-Api-Version'] = '2022-11-28';
    }


    https.get(options, (response) => {
      const chunks_of_data = [];

      response.on('data', (fragments) => {
        chunks_of_data.push(fragments);
      });

      response.on('end', () => {
        const response_body = Buffer.concat(chunks_of_data);
        try {
          const videoLanguages = JSON.parse(response_body.toString());
          if (videoLanguages.message) {
            reject(videoLanguages.message);
          }
          let downloadedCount = 0;
          for (const language of videoLanguages) {
            console.log(`${LOG_TAG} downloadPromoVideoSubtiles ${JSON.stringify(language)}`);
            const filePath = `${PATH}/promo-video/${language.name}`;
            console.log(`${LOG_TAG} videoLanguages ${filePath}`);
            console.log(`${LOG_TAG} checking if ${filePath} exists ${fs.existsSync(filePath)}`);
            if (fs.existsSync(filePath)) {
              const localHash = getLocalHash(filePath);
              console.log(`${LOG_TAG} remote subtitle hash ${language.name} ${language.sha}`);
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
          console.log(`${LOG_TAG} Downloaded ${downloadedCount} and skipped ${videoLanguages.length - downloadedCount} existing video subtitles`);
          resolve();
        } catch (e) {
          reject(`Unable to download video subtitles. Trying again at next restart. Reason: ${e instanceof Error ? e.message : e}`);
        }
      });

      response.on('error', (error) => {
        reject(error);
      });
    });
  });
}

function downloadPromoVideo$() {
  return new Promise((resolve, reject) => {
    console.log(`${LOG_TAG} Checking if promo video needs downloading or updating...`);
    const options = {
      host: 'api.github.com',
      path: '/repos/mempool/mempool-promo/contents',
      method: 'GET',
      headers: {'user-agent': 'node.js'}
    };

    if (githubSecret) {
      console.log(`${LOG_TAG} Downloading the promo videos with authentication`);
      options.headers['authorization'] = `Bearer ${githubSecret}`;
      options.headers['X-GitHub-Api-Version'] = '2022-11-28';
    }

    https.get(options, (response) => {
      const chunks_of_data = [];

      response.on('data', (fragments) => {
        chunks_of_data.push(fragments);
      });

      response.on('end', () => {
        const response_body = Buffer.concat(chunks_of_data);
        try {
          const contents = JSON.parse(response_body.toString());
          if (contents.message) {
            reject(contents.message);
          }
          for (const item of contents) {
            if (item.name !== 'promo.mp4') {
              continue;
            }
            const filePath = `${PATH}/promo-video/mempool-promo.mp4`;
            console.log(`${LOG_TAG} promoVideo ${filePath}`);
            if (fs.existsSync(filePath)) {
              const localHash = getLocalHash(filePath);
              console.log(`${LOG_TAG} promo video hash ${item.sha}`);
              if (localHash !== item.sha) {
                console.log(`${LOG_TAG} mempool-promo.mp4 is different on the remote, updating`);
                download(filePath, item.download_url);
                console.log(`${LOG_TAG} mempool-promo.mp4 downloaded.`);
              } else {
                console.log(`${LOG_TAG} mempool-promo.mp4 is already up to date. Skipping.`);
              }
            } else {
              console.log(`${LOG_TAG} mempool-promo.mp4 is missing, downloading`);
              download(filePath, item.download_url);
            }
          }
          resolve();
        } catch (e) {
          reject(`Unable to download video. Trying again at next restart. Reason: ${e instanceof Error ? e.message : e}`);
        }
      });

      response.on('error', (error) => {
        reject(error);
      });
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

console.log(`${LOG_TAG} Downloading assets`);
download(PATH + '/assets.json', assetsJsonUrl);
console.log(`${LOG_TAG} Downloading assets minimal`);
download(PATH + '/assets.minimal.json', assetsMinimalJsonUrl);
console.log(`${LOG_TAG} Downloading testnet assets`);
download(PATH + '/assets-testnet.json', testnetAssetsJsonUrl);
console.log(`${LOG_TAG} Downloading testnet assets minimal`);
download(PATH + '/assets-testnet.minimal.json', testnetAssetsMinimalJsonUrl);

(() => {
  console.log(`${LOG_TAG} down mining pool logos`);
  downloadMiningPoolLogos$()
  .then(() => {
    console.log(`${LOG_TAG} downloading promo video subtitles`);
    downloadPromoVideoSubtiles$();
  })
  .then(() => {
    console.log(`${LOG_TAG} downloading promo videos`);
    downloadPromoVideo$();
  })
  .catch((error) => {
    throw new Error(error);
  });
})();
