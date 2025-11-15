const https = require('https');
const fsSync = require('fs');
const crypto = require('crypto');
const path = require('node:path');

// Configuration
const LOG_TAG = '[sync-assets]';
const CONFIG_FILE_NAME = 'mempool-frontend-config.json';

const config = {
  verbose: parseInt(process.env.VERBOSE) === 1,
  mempoolCDN: parseInt(process.env.MEMPOOL_CDN) === 1,
  dryRun: parseInt(process.env.DRY_RUN) === 1,
  githubToken: process.env.GITHUB_TOKEN,
};

// Early exit if SKIP_SYNC is set
if (parseInt(process.env.SKIP_SYNC) === 1) {
  console.log(`${LOG_TAG} SKIP_SYNC is set, not checking any assets`);
  process.exit(0);
}

// Log configuration
if (config.verbose) console.log(`${LOG_TAG} VERBOSE is set, logs will be more verbose`);
if (config.mempoolCDN) console.log(`${LOG_TAG} MEMPOOL_CDN is set, assets will be downloaded from mempool.space`);
if (config.dryRun) console.log(`${LOG_TAG} DRY_RUN is set, not downloading any assets`);

// Setup assets path
const ASSETS_PATH = (() => {
  if (!process.argv[2]) {
    throw new Error('Resource path argument is not set');
  }
  const rawPath = process.argv[2].endsWith("/") ? process.argv[2] : `${process.argv[2]}/`;
  const normalizedPath = path.resolve(path.normalize(rawPath));
  console.log(`${LOG_TAG} using ASSETS_PATH ${normalizedPath}`);

  if (!fsSync.existsSync(normalizedPath)) {
    console.log(`${LOG_TAG} ${normalizedPath} does not exist, creating`);
    fsSync.mkdirSync(normalizedPath, { recursive: true });
  }

  return normalizedPath;
})();

// Load frontend config
const loadConfig = () => {
  try {
    const rawConfig = fsSync.readFileSync(CONFIG_FILE_NAME, 'utf8');
    console.log(`${LOG_TAG} ${CONFIG_FILE_NAME} file found, using provided config`);
    return JSON.parse(rawConfig);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    console.log(`${LOG_TAG} ${CONFIG_FILE_NAME} file not found, using default config`);
    return {};
  }
};

const configContent = loadConfig();

// Utility: Make HTTPS request
const httpsRequest = (options) => {
  return new Promise((resolve, reject) => {
    https.get(options, (response) => {
      const chunks = [];

      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
};

// Utility: Download file
const downloadFile = (filePath, url) => {
  if (!filePath || !url) {
    if (config.verbose) {
      console.log('skipping malformed download request: ', filePath, url);
    }
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode < 200 || response.statusCode > 299) {
        reject(new Error(`HTTP Error ${response.statusCode} while fetching '${filePath}'`));
        return;
      }

      const writeStream = fsSync.createWriteStream(filePath);
      response.pipe(writeStream);

      writeStream.on('finish', () => {
        if (config.verbose) {
          console.log(`${LOG_TAG} \tFinished downloading ${url} to ${filePath}`);
        }
        resolve();
      });

      writeStream.on('error', reject);
    }).on('error', reject);
  });
};

// Utility: Get local file hash (Git blob format)
const getLocalHash = (filePath) => {
  const stats = fsSync.statSync(filePath);
  const buffer = fsSync.readFileSync(filePath);
  const bufferWithHeader = Buffer.concat([
    Buffer.from('blob '),
    Buffer.from(`${stats.size}`),
    Buffer.from('\0'),
    buffer
  ]);
  const hash = crypto.createHash('sha1').update(bufferWithHeader).digest('hex');

  if (config.verbose) {
    console.log(`${LOG_TAG} \t\tgetLocalHash ${filePath} ${hash}`);
  }

  return hash;
};

// Utility: Create GitHub API options
const createGitHubOptions = (repoPath) => {
  const options = {
    host: 'api.github.com',
    path: repoPath,
    method: 'GET',
    headers: { 'user-agent': 'node.js' }
  };

  if (config.githubToken) {
    options.headers['authorization'] = `Bearer ${config.githubToken}`;
    options.headers['X-GitHub-Api-Version'] = '2022-11-28';
  }

  return options;
};

// Utility: Replace URL for CDN
const getCDNUrl = (url, replacePattern) => {
  return config.mempoolCDN ? url.replace(replacePattern.from, replacePattern.to) : url;
};

// Utility: Ensure directory exists
const ensureDirectory = (dirPath) => {
  if (!fsSync.existsSync(dirPath)) {
    fsSync.mkdirSync(dirPath, { recursive: true });
  }
};

// Core: Process file item (handles checking and downloading)
const processFileItem = async (item, options) => {
  const {
    filePath,
    remoteHash,
    downloadUrl,
    cdnPattern,
    itemName,
    downloadDir
  } = options;

  const fileExists = fsSync.existsSync(filePath);

  if (fileExists) {
    const localHash = getLocalHash(filePath);

    if (config.verbose) {
      console.log(`${LOG_TAG} \t\tremote ${itemName} hash ${remoteHash}`);
    }

    if (localHash !== remoteHash) {
      console.log(`${LOG_TAG} \t\t${itemName} is different on the remote, downloading...`);

      if (config.dryRun) {
        console.log(`${LOG_TAG} \t\tDRY_RUN is set, not downloading ${itemName} but we should`);
        return false;
      }

      const url = getCDNUrl(downloadUrl, cdnPattern);
      if (config.verbose) {
        console.log(`${LOG_TAG} \t\tDownloading ${url} to ${filePath}`);
      }
      await downloadFile(filePath, url);
      return true;
    } else {
      console.log(`${LOG_TAG} \t\t${itemName} is already up to date. Skipping.`);
      return false;
    }
  } else {
    console.log(`${LOG_TAG} \t\t${itemName} is missing, downloading...`);
    ensureDirectory(downloadDir);

    if (config.dryRun) {
      console.log(`${LOG_TAG} \t\tDRY_RUN is set, not downloading ${itemName} but we should`);
      return false;
    }

    const url = getCDNUrl(downloadUrl, cdnPattern);
    if (config.verbose) {
      console.log(`${LOG_TAG} \t\tDownloading ${url} to ${filePath}`);
    }
    await downloadFile(filePath, url);
    return true;
  }
};

// Core: Fetch GitHub directory contents
const fetchGitHubContents = async (repoPath, useAuth = false) => {
  if (useAuth && config.githubToken) {
    console.log(`${LOG_TAG} \tDownloading with authentication`);
  }

  const options = createGitHubOptions(repoPath);
  const responseBody = await httpsRequest(options);
  const contents = JSON.parse(responseBody.toString());

  if (contents.message) {
    throw new Error(contents.message);
  }

  return contents;
};

// Main: Download mining pool logos
const downloadMiningPoolLogos = async () => {
  console.log(`${LOG_TAG} \tChecking if mining pool logos needs downloading or updating...`);

  try {
    const poolLogos = await fetchGitHubContents('/repos/mempool/mining-pool-logos/contents/', !!config.githubToken);

    let downloadedCount = 0;
    const validFiles = poolLogos.filter(item => item.type === 'file' && item.download_url);

    for (const poolLogo of validFiles) {
      if (config.verbose) {
        console.log(`${LOG_TAG} Processing ${poolLogo.name}`);
      }

      const downloaded = await processFileItem(poolLogo, {
        filePath: `${ASSETS_PATH}/mining-pools/${poolLogo.name}`,
        remoteHash: poolLogo.sha,
        downloadUrl: poolLogo.download_url,
        cdnPattern: {
          from: "raw.githubusercontent.com/mempool/mining-pool-logos/master",
          to: "mempool.space/resources/mining-pools"
        },
        itemName: poolLogo.name,
        downloadDir: `${ASSETS_PATH}/mining-pools/`
      });

      if (downloaded) downloadedCount++;
    }

    console.log(`${LOG_TAG} \t\tDownloaded ${downloadedCount} and skipped ${validFiles.length - downloadedCount} existing mining pool logos`);
  } catch (e) {
    throw new Error(`Unable to download mining pool logos. Trying again at next restart. Reason: ${e instanceof Error ? e.message : e}`);
  }
};

// Main: Download promo video subtitles
const downloadPromoVideoSubtitles = async () => {
  console.log(`${LOG_TAG} \tChecking if promo video subtitles needs downloading or updating...`);

  try {
    const subtitles = await fetchGitHubContents('/repos/mempool/mempool-promo/contents/subtitles', !!config.githubToken);

    let downloadedCount = 0;
    const validFiles = subtitles.filter(item => item.type === 'file' && item.download_url);

    for (const subtitle of validFiles) {
      if (config.verbose) {
        console.log(`${LOG_TAG} Processing ${subtitle.name}`);
      }

      const downloaded = await processFileItem(subtitle, {
        filePath: `${ASSETS_PATH}/promo-video/${subtitle.name}`,
        remoteHash: subtitle.sha,
        downloadUrl: subtitle.download_url,
        cdnPattern: {
          from: "raw.githubusercontent.com/mempool/mempool-promo/master/subtitles",
          to: "mempool.space/resources/promo-video"
        },
        itemName: subtitle.name,
        downloadDir: `${ASSETS_PATH}/promo-video/`
      });

      if (downloaded) downloadedCount++;
    }

    console.log(`${LOG_TAG} Downloaded ${downloadedCount} and skipped ${validFiles.length - downloadedCount} existing video subtitles`);
  } catch (e) {
    throw new Error(`Unable to download video subtitles. Trying again at next restart. Reason: ${e instanceof Error ? e.message : e}`);
  }
};

// Main: Download promo video
const downloadPromoVideo = async () => {
  console.log(`${LOG_TAG} \tChecking if promo video needs downloading or updating...`);

  try {
    const contents = await fetchGitHubContents('/repos/mempool/mempool-promo/contents', !!config.githubToken);

    const videoItem = contents.find(item => item.name === 'promo.mp4');
    if (!videoItem) {
      console.log(`${LOG_TAG} \tpromo.mp4 not found in repository`);
      return;
    }

    await processFileItem(videoItem, {
      filePath: `${ASSETS_PATH}/promo-video/mempool-promo.mp4`,
      remoteHash: videoItem.sha,
      downloadUrl: videoItem.download_url,
      cdnPattern: {
        from: "raw.githubusercontent.com/mempool/mempool-promo/master/promo.mp4",
        to: "mempool.space/resources/promo-video/mempool-promo.mp4"
      },
      itemName: 'mempool-promo.mp4',
      downloadDir: `${ASSETS_PATH}/promo-video/`
    });
  } catch (e) {
    throw new Error(`Unable to download video. Trying again at next restart. Reason: ${e instanceof Error ? e.message : e}`);
  }
};

// Download Liquid assets if configured
const downloadLiquidAssets = () => {
  if (configContent.BASE_MODULE !== 'liquid') {
    if (config.verbose) {
      console.log(`${LOG_TAG} BASE_MODULE is not set to Liquid (currently ${configContent.BASE_MODULE}), skipping downloading assets`);
    }
    return;
  }

  const liquidAssets = [
    { file: 'assets.json', url: 'https://raw.githubusercontent.com/Blockstream/asset_registry_db/master/index.json' },
    { file: 'assets.minimal.json', url: 'https://raw.githubusercontent.com/Blockstream/asset_registry_db/master/index.minimal.json' },
    { file: 'assets-testnet.json', url: 'https://raw.githubusercontent.com/Blockstream/asset_registry_testnet_db/master/index.json' },
    { file: 'assets-testnet.minimal.json', url: 'https://raw.githubusercontent.com/Blockstream/asset_registry_testnet_db/master/index.minimal.json' }
  ];

  console.log(`${LOG_TAG} Downloading assets`);
  liquidAssets.forEach(({ file, url }) => {
    const fileName = file.replace(/^assets/, 'assets');
    console.log(`${LOG_TAG} Downloading ${fileName}`);
    downloadFile(`${ASSETS_PATH}/${fileName}`, url);
  });
};

// Main execution
(async () => {
  try {
    // Download Liquid assets (non-blocking)
    downloadLiquidAssets();

    // Download GitHub assets sequentially
    if (config.verbose) {
      console.log(`${LOG_TAG} Downloading mining pool logos`);
    }
    await downloadMiningPoolLogos();

    if (config.verbose) {
      console.log(`${LOG_TAG} Downloading promo video subtitles`);
    }
    await downloadPromoVideoSubtitles();

    if (config.verbose) {
      console.log(`${LOG_TAG} Downloading promo video`);
    }
    await downloadPromoVideo();

    console.log(`${LOG_TAG} Asset synchronization complete`);
  } catch (error) {
    console.error(`${LOG_TAG} Error:`, error.message);
    process.exit(1);
  }
})();
