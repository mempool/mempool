var axios = require('axios');
var fs = require('fs');
var stream = require('stream');
var util = require('util');
var finished = util.promisify(stream.finished);
var { SocksProxyAgent } = require('socks-proxy-agent');

const CONFIG_FILE_NAME = 'mempool-frontend-config.json';
let configContent = {};

var PATH = 'dist/mempool/browser/en-US/resources/';
if (process.argv[2] && process.argv[2] === 'dev') {
  PATH = 'src/resources/';
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

function setDelay(secs) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve()
    }, secs * 1000);
  });
}

async function fetch(url, isFile) {
  var retry = 0;
  var axiosOptions = {
    headers: {
      'User-Agent': `${configContent.USER_AGENT}`
    },
    timeout: 30000
  }
  if (isFile) {
    axiosOptions.responseType = 'stream';
  }
  while (retry < 5) {
    try {
      if (configContent.SOCKS_PROXY === true) {
        var socksOptions = {
          agentOptions: {
            keepAlive: true,
          },
          hostname: configContent.SOCKS_HOST,
          port: configContent.SOCKS_PORT
        }

        if (configContent.SOCKS_USERNAME && configContent.SOCKS_PASSWORD) {
          socksOptions.username = configContent.SOCKS_USERNAME;
          socksOptions.password = configContent.SOCKS_PASSWORD;
        } else {
          // Retry with different tor circuits https://stackoverflow.com/a/64960234
          socksOptions.username = `circuit${retry}`;
        }
        axiosOptions.httpsAgent = new SocksProxyAgent(socksOptions);
      }
      var response = await axios.get(url, axiosOptions);
      if (response.status < 200 || response.status > 299) {
        throw new Error('HTTP Error ' + response.status + ' while fetching \'' + filename + '\'');
      }
      return response.data;
    } catch (e) {
      console.error(`Failed to fetch data from ${url}, will retry`);
      console.error(e);
      retry++;
    }
    await setDelay(10);
  }
}

async function download(filename, url) {
  try {
    var writer = fs.createWriteStream(filename);
    var stream = await fetch(url, true);
    stream.pipe(writer);
    await finished(writer);
  } catch (e) {
    console.error(`Failed to write stream data for ${filename}`);
    console.error(e);
  }
}

async function downloadMiningPoolLogos() {
  var poolLogos = await fetch('https://api.github.com/repos/mempool/mining-pool-logos/contents');
  for (var i = 0; i < poolLogos.length; ++i) {
    download(`${PATH}/mining-pools/${poolLogos[i].name}`, poolLogos[i].download_url);
  }
}

const poolsJsonUrl = 'https://raw.githubusercontent.com/mempool/mining-pools/master/pools.json';
let assetsJsonUrl = 'https://raw.githubusercontent.com/mempool/asset_registry_db/master/index.json';
let assetsMinimalJsonUrl = 'https://raw.githubusercontent.com/mempool/asset_registry_db/master/index.minimal.json';

if (configContent.BASE_MODULE && configContent.BASE_MODULE === 'liquid') {
  assetsJsonUrl = 'https://raw.githubusercontent.com/Blockstream/asset_registry_db/master/index.json';
  assetsMinimalJsonUrl = 'https://raw.githubusercontent.com/Blockstream/asset_registry_db/master/index.minimal.json';
}

const testnetAssetsJsonUrl = 'https://raw.githubusercontent.com/Blockstream/asset_registry_testnet_db/master/index.json';
const testnetAssetsMinimalJsonUrl = 'https://raw.githubusercontent.com/Blockstream/asset_registry_testnet_db/master/index.minimal.json';

console.log('Downloading assets');
download(PATH + 'assets.json', assetsJsonUrl);
console.log('Downloading assets minimal');
download(PATH + 'assets.minimal.json', assetsMinimalJsonUrl);
console.log('Downloading mining pools info');
download(PATH + 'pools.json', poolsJsonUrl);
console.log('Downloading testnet assets');
download(PATH + 'assets-testnet.json', testnetAssetsJsonUrl);
console.log('Downloading testnet assets minimal');
download(PATH + 'assets-testnet.minimal.json', testnetAssetsMinimalJsonUrl);
console.log('Downloading mining pool logos');
downloadMiningPoolLogos();
