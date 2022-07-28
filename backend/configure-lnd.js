const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');

const LND_PROTO_FILE_LOCATION = 'src/api/lightning/lnd/proto/lightning.proto';
const LND_PROTO_TYPES_DIR = 'src/api/lightning/lnd/types/';
var lndVersion = process.argv[2];

function downloadProto(commit, old=false) {
  return new Promise(resolve => {
    var data = '';
    const req = https.request(`https://raw.githubusercontent.com/lightningnetwork/lnd/${commit}/lnrpc/${old ? 'rpc' : 'lightning'}.proto`, async res => {
      if (res.statusCode === 404) {
        if (!old) {
          resolve(await downloadProto(commit, true));
          return;
        }
        console.error('Server returned 404 Not Found, this version probably doesn\'t exist or another error occured');
        process.exit(1);
      }
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', error => {
      console.error(error);
      console.error('Error while downloading LND proto file');
      process.exit(1);
    });

    req.end();
  });
}

function getLNDCommit() {
  try {
    const ver = execSync('lnd --version').toString().trim();
    const commit = ver.split('commit=')[1];
    return commit;
  } catch (e) {
    console.error(e);
    console.error('Failed to get LND version automatically, provide it manually please');
    process.exit(1);
  }
}

if (!lndVersion) {
  lndVersion = getLNDCommit();
  console.log(`Auto-detected LND version '${lndVersion}' with 'lnd --version'`);
}

fs.mkdirSync(LND_PROTO_TYPES_DIR, { recursive: true });

if (lndVersion === 'fallback') {
  const path = LND_PROTO_TYPES_DIR + '/lnrpc/Lightning.ts';
  if (fs.existsSync(path)) {
    process.exit(0);
  }
  fs.mkdirSync(LND_PROTO_TYPES_DIR + '/lnrpc');
  fs.writeFileSync(path, 'export type LightningClient = any');
  process.exit(0);
}

fs.rmSync(LND_PROTO_TYPES_DIR, { recursive: true, force: true });
fs.mkdirSync(LND_PROTO_TYPES_DIR, { recursive: true });
fs.mkdirSync(LND_PROTO_FILE_LOCATION.split('/').slice(0, -1).join('/'), { recursive: true });

downloadProto(lndVersion).then(data => {
  const file = data.split('\n').filter(l => !/^\s+\/\//.test(l)).join('\n');
  fs.writeFileSync(LND_PROTO_FILE_LOCATION, file);

  try {
    execSync(`npx proto-loader-gen-types --keepCase --longs=String --enums=String --defaults --oneofs --grpcLib=@grpc/grpc-js --outDir=${LND_PROTO_TYPES_DIR} ${LND_PROTO_FILE_LOCATION}`);
  }
  catch (e) {
    console.error(e);
    console.error('Error while generating LND proto typescript types');
    process.exit(1);
  }

  console.log('Download and type generation successful!');
});
