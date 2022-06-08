const fs = require('fs');
const execSync = require('child_process').execSync;

const CONFIG_FILE_NAME = 'mempool-frontend-config.json';
const SAMPLE_CONFIG_FILE_NAME = 'mempool-frontend-config.sample.json';
let configContent;

try {
  const rawConfig = fs.readFileSync(CONFIG_FILE_NAME);
  configContent = JSON.parse(rawConfig);
  console.log(`${CONFIG_FILE_NAME} file found, using provided config`);
} catch (e) {
  if (e.code !== 'ENOENT') {
    throw new Error(e);
  } else {
    console.log(`${CONFIG_FILE_NAME} file not found, using default config`);
    try {
      const rawConfig = fs.readFileSync(SAMPLE_CONFIG_FILE_NAME);
      configContent = JSON.parse(rawConfig);
    } catch (e) {
      console.log("sample config not found, falling back to BASE_MODULE = mempool");
      configContent = { BASE_MODULE: "mempool" };
    }
  }
}

const BASE_MODULE = configContent.BASE_MODULE ? configContent.BASE_MODULE : "mempool";
console.log(`Building lib file for ${BASE_MODULE}`);

const basePath = __dirname;
const libPath  = __dirname + '/mempool.js';

let INSTALL_COMMAND = `cd ${libPath} && npm install --verbose`;
let EXPORT_COMMAND = `rm -rf mempooljs && mkdir -p mempooljs && cd ${libPath} && ./node_modules/.bin/tsc | ./node_modules/.bin/browserify -p tinyify lib/index.js --standalone ${BASE_MODULE}JS > ${basePath}/mempooljs/${BASE_MODULE}.js`;

execSync(INSTALL_COMMAND, {
  stdio: 'inherit'
}, function(error, stdout, stderr) {
  console.log(stdout);
  console.log(error);
  console.log(stderr);
});

execSync(EXPORT_COMMAND, {
  stdio: 'inherit'
}, function(error, stdout, stderr) {
  console.log(stdout);
  console.log(error);
  console.log(stderr);
});
