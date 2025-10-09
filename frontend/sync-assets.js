var https = require('https');
var fs = require('fs');
var crypto = require('crypto');
var path = require('node:path');
const LOG_TAG = '[sync-assets]';
let verbose = false;
let MEMPOOL_CDN = false;
let DRY_RUN = false;

if (parseInt(process.env.SKIP_SYNC) === 1) {
  console.log(`${LOG_TAG} SKIP_SYNC is set, not checking any assets`);
  process.exit(0);
}

if (parseInt(process.env.VERBOSE) === 1) {
  console.log(`${LOG_TAG} VERBOSE is set, logs will be more verbose`);
  verbose = true;
}

if (parseInt(process.env.MEMPOOL_CDN) === 1) {
  console.log(`${LOG_TAG} MEMPOOL_CDN is set, assets will be downloaded from mempool.space`);
  MEMPOOL_CDN = true;
}

if (parseInt(process.env.DRY_RUN) === 1) {
  console.log(`${LOG_TAG} DRY_RUN is set, not downloading any assets`);
  DRY_RUN = true;
}

const githubSecret = process.env.GITHUB_TOKEN;

const CONFIG_FILE_NAME = 'mempool-frontend-config.json';
let configContent = {};

var ASSETS_PATH;
if (process.argv[2]) {
  ASSETS_PATH = process.argv[2];
  ASSETS_PATH += ASSETS_PATH.endsWith("/") ? "" : "/"
  ASSETS_PATH = path.resolve(path.normalize(ASSETS_PATH));
  console.log(`[sync-assets] using ASSETS_PATH ${ASSETS_PATH}`);
  if (!fs.existsSync(ASSETS_PATH)){
    console.log(`${LOG_TAG} ${ASSETS_PATH} does not exist, creating`);
    fs.mkdirSync(ASSETS_PATH, { recursive: true });
  }
}

if (!ASSETS_PATH) {
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

function download(filename, url) {
  if (!filename || !url) {
    if (verbose) {
      console.log('skipping malformed download request: ', filename, url);
    }
    return;
  }
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
    if (verbose) {
      console.log(`${LOG_TAG} \tFinished downloading ${url} to ${filename}`);
    }
  });
}

function getLocalHash(filePath) {
  const size = fs.statSync(filePath);
  const buffer = fs.readFileSync(filePath);
  const bufferWithHeader = Buffer.concat([Buffer.from('blob '), Buffer.from(`${size.size}`), Buffer.from('\0'), buffer]);
  const hash = crypto.createHash('sha1').update(bufferWithHeader).digest('hex');

  if (verbose) {
    console.log(`${LOG_TAG} \t\tgetLocalHash ${filePath} ${hash}`);
  }

  return hash;
}

function downloadMiningPoolLogos$() {
  return new Promise((resolve, reject) => {
    console.log(`${LOG_TAG} \tChecking if mining pool logos needs downloading or updating...`);
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
            if (poolLogo.type !== 'file' || poolLogo.download_url == null) {
              continue;
            }
            if (verbose) {
              console.log(`${LOG_TAG} Processing ${poolLogo.name}`);
            }
            console.log(`${ASSETS_PATH}/mining-pools/${poolLogo.name}`);
            const filePath = `${ASSETS_PATH}/mining-pools/${poolLogo.name}`;
            if (fs.existsSync(filePath)) {
              const localHash = getLocalHash(filePath);
              if (verbose) {
                console.log(`${LOG_TAG} \t\tremote ${poolLogo.name} logo hash ${poolLogo.sha}`);
                console.log(`${LOG_TAG} \t\t\tchecking if ${filePath} exists: ${fs.existsSync(filePath)}`);
              }
              if (localHash !== poolLogo.sha) {
                console.log(`${LOG_TAG} \t\t\t\t${poolLogo.name} is different on the remote, downloading...`);
                let download_url = poolLogo.download_url;
                if (MEMPOOL_CDN) {
                  download_url = download_url.replace("raw.githubusercontent.com/mempool/mining-pool-logos/master", "mempool.space/resources/mining-pools");
                }
                if (DRY_RUN) {
                  console.log(`${LOG_TAG} \t\tDRY_RUN is set, not downloading ${poolLogo.name} but we should`);
                } else {
                  if (verbose) {
                    console.log(`${LOG_TAG} \t\tDownloading ${download_url} to ${filePath}`);
                  }
                  download(filePath, download_url);
                  downloadedCount++;
                }
              } else {
                console.log(`${LOG_TAG} \t\t${poolLogo.name} is already up to date. Skipping.`);
              }
            } else {
              console.log(`${LOG_TAG} \t\t${poolLogo.name} is missing, downloading...`);
              const miningPoolsDir = `${ASSETS_PATH}/mining-pools/`;
              if (!fs.existsSync(miningPoolsDir)){
                fs.mkdirSync(miningPoolsDir, { recursive: true });
              }
              let download_url = poolLogo.download_url;
              if (MEMPOOL_CDN) {
                download_url = download_url.replace("raw.githubusercontent.com/mempool/mining-pool-logos/master", "mempool.space/resources/mining-pools");
              }
              if (DRY_RUN) {
                console.log(`${LOG_TAG} DRY_RUN is set, not downloading ${poolLogo.name} but it should`);
              } else {
                console.log(`${LOG_TAG} \tDownloading ${download_url} to ${filePath}`);
                download(filePath, download_url);
                downloadedCount++;
              }
            }
          }
          console.log(`${LOG_TAG} \t\tDownloaded ${downloadedCount} and skipped ${poolLogos.length - downloadedCount} existing mining pool logos`);
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
    console.log(`${LOG_TAG} \tChecking if promo video subtitles needs downloading or updating...`);
    const options = {
      host: 'api.github.com',
      path: '/repos/mempool/mempool-promo/contents/subtitles',
      method: 'GET',
      headers: {'user-agent': 'node.js'}
    };

    if (githubSecret) {
      console.log(`${LOG_TAG} \tDownloading the promo video subtitles with authentication`);
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
            if (language.type !== 'file' || language.download_url == null) {
              continue;
            }
            if (verbose) {
              console.log(`${LOG_TAG} Processing ${language.name}`);
            }
            const filePath = `${ASSETS_PATH}/promo-video/${language.name}`;
            if (fs.existsSync(filePath)) {
              if (verbose) {
                console.log(`${LOG_TAG} \t${language.name} remote promo video hash ${language.sha}`);
              }
              const localHash = getLocalHash(filePath);
              if (localHash !== language.sha) {
                console.log(`${LOG_TAG} \t\t${language.name} is different on the remote, updating`);
                let download_url = language.download_url;
                if (MEMPOOL_CDN) {
                  download_url = download_url.replace("raw.githubusercontent.com/mempool/mempool-promo/master/subtitles", "mempool.space/resources/promo-video");
                }
                if (DRY_RUN) {
                  console.log(`${LOG_TAG} \t\tDRY_RUN is set, not downloading ${language.name} but we should`);
                } else {
                  if (verbose) {
                    console.log(`${LOG_TAG} \t\tdownloading ${download_url} to ${filePath}`);
                  }
                  download(filePath, download_url);
                  downloadedCount++;
                }
              } else {
                console.log(`${LOG_TAG} \t\t${language.name} is already up to date. Skipping.`);
              }
            } else {
              console.log(`${LOG_TAG} \t\t${language.name} is missing, downloading`);
              const promoVideosDir = `${ASSETS_PATH}/promo-video/`;
              if (!fs.existsSync(promoVideosDir)){
                fs.mkdirSync(promoVideosDir, { recursive: true });
              }

              let download_url = language.download_url;
              if (MEMPOOL_CDN) {
                download_url = download_url.replace("raw.githubusercontent.com/mempool/mempool-promo/master/subtitles", "mempool.space/resources/promo-video");
              }
              if (DRY_RUN) {
                console.log(`${LOG_TAG} \tDRY_RUN is set, not downloading ${language.name} but we should`);
              } else {
                if (verbose) {
                  console.log(`${LOG_TAG} downloading ${download_url} to ${filePath}`);
                }
                download(filePath, download_url);
                downloadedCount++;
              }
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
    console.log(`${LOG_TAG} \tChecking if promo video needs downloading or updating...`);
    const options = {
      host: 'api.github.com',
      path: '/repos/mempool/mempool-promo/contents',
      method: 'GET',
      headers: {'user-agent': 'node.js'}
    };

    if (githubSecret) {
      console.log(`${LOG_TAG} \tDownloading the promo video with authentication`);
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
            const filePath = `${ASSETS_PATH}/promo-video/mempool-promo.mp4`;
            if (fs.existsSync(filePath)) {
              const localHash = getLocalHash(filePath);

              if (localHash !== item.sha) {
                console.log(`${LOG_TAG} \tmempool-promo.mp4 is different on the remote, updating`);
                let download_url = item.download_url;
                if (MEMPOOL_CDN) {
                  download_url = download_url.replace("raw.githubusercontent.com/mempool/mempool-promo/master/promo.mp4", "mempool.space/resources/promo-video/mempool-promo.mp4");
                }
                if (DRY_RUN) {
                  console.log(`${LOG_TAG} DRY_RUN is set, not downloading mempool-promo.mp4 but we should`);
                } else {
                  if (verbose) {
                    console.log(`${LOG_TAG} downloading ${download_url} to ${filePath}`);
                  }
                  download(filePath, download_url);
                  console.log(`${LOG_TAG} \tmempool-promo.mp4 downloaded.`);
                }
              } else {
                console.log(`${LOG_TAG} \t\tmempool-promo.mp4 is already up to date. Skipping.`);
              }
            } else {
              console.log(`${LOG_TAG} \tmempool-promo.mp4 is missing, downloading`);
              let download_url = item.download_url;
              if (MEMPOOL_CDN) {
                download_url = download_url.replace("raw.githubusercontent.com/mempool/mempool-promo/master/promo.mp4", "mempool.space/resources/promo-video/mempool-promo.mp4");
              }
              if (DRY_RUN) {
                console.log(`${LOG_TAG} DRY_RUN is set, not downloading mempool-promo.mp4 but we should`);
              } else {
                if (verbose) {
                  console.log(`${LOG_TAG} downloading ${download_url} to ${filePath}`);
                }
                download(filePath, download_url);
              }
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


if (configContent.BASE_MODULE && configContent.BASE_MODULE === 'liquid') {
  const assetsJsonUrl = 'https://raw.githubusercontent.com/Blockstream/asset_registry_db/master/index.json';
  const assetsMinimalJsonUrl = 'https://raw.githubusercontent.com/Blockstream/asset_registry_db/master/index.minimal.json';
  const testnetAssetsJsonUrl = 'https://raw.githubusercontent.com/Blockstream/asset_registry_testnet_db/master/index.json';
  const testnetAssetsMinimalJsonUrl = 'https://raw.githubusercontent.com/Blockstream/asset_registry_testnet_db/master/index.minimal.json';

  console.log(`${LOG_TAG} Downloading assets`);
  download(`${ASSETS_PATH}/assets.json`, assetsJsonUrl);

  console.log(`${LOG_TAG} Downloading assets minimal`);
  download(`${ASSETS_PATH}/assets.minimal.json`, assetsMinimalJsonUrl);

  console.log(`${LOG_TAG} Downloading testnet assets`);
  download(`${ASSETS_PATH}/assets-testnet.json`, testnetAssetsJsonUrl);

  console.log(`${LOG_TAG} Downloading testnet assets minimal`);
  download(`${ASSETS_PATH}/assets-testnet.minimal.json`, testnetAssetsMinimalJsonUrl);
} else {
  if (verbose) {
    console.log(`${LOG_TAG} BASE_MODULE is not set to Liquid (currently ${configContent.BASE_MODULE}), skipping downloading assets`);
  }
}

(() => {
  if (verbose) {
    console.log(`${LOG_TAG} Downloading mining pool logos`);
  }
  downloadMiningPoolLogos$()
  .then(() => {
    if (verbose) {
      console.log(`${LOG_TAG} Downloading promo video subtitles`);
    }
    downloadPromoVideoSubtiles$();
  })
  .then(() => {
    if (verbose) {
      console.log(`${LOG_TAG} Downloading promo video`);
    }
    downloadPromoVideo$();
  })
  .catch((error) => {
    throw new Error(error);
  });
})();