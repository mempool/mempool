'use strict';

var fs = require('fs');
var minimist = require('minimist');
var RpcClient = require('bitcoind-rpc');

// parse arguments
var args = minimist(process.argv.slice(2), {
  alias: {'testnet': 't', 'port': 'p', 'host': 'h'},
  string: ['rpcuser', 'rpcpassword', 'port', 'h'],
  boolean: ['testnet']
});

// setup rpc config
var config = {
  protocol: 'http',
  user: args.rpcuser,
  pass: args.rpcpassword,
  host: args.host || '127.0.0.1',
  port: args.port || (args.testnet ? '18332' : '8332')
};

// parse RPC user/pass from config file if necessary
if (!config.user && !config.pass) {
  var configPath = process.env.HOME + '/Library/Application\ Support/Bitcoin/bitcoin.conf';
  if (!fs.existsSync(configPath)) {
    throw new Error('Coudn\'t found bitcoin.conf file, use --rpcuser=USER and --rpcpassword=PASS');
  }

  var file = fs.readFileSync(configPath).toString();
  var username = file.match(/rpcuser=(.*)/);
  var password = file.match(/rpcpassword=(.*)/);

  config.user = username && username[1];
  config.pass = password && password[1];

  if (!config.user && !config.pass) {
    throw new Error('Coudn\'t parse rpc user and password from bitcoin.conf file');
  }
}

var client = new RpcClient(config);

var method = args._.length > 0 && args._[0];
if (!method || !client[method]) return showHelp('Invalid RPC method');

var params = args._.slice(1).map(parseJSON).concat(onResponse);
client[method].apply(client, params);

function parseJSON(arg) {
  try {
    return JSON.parse(arg);
  } catch (err) {
    return arg;
  }
}

function onResponse(err, data) {
  if (err) return console.log(err.message);
  console.log(data.result);
}

function showHelp(message) {
  console.log('Error:', message);
  console.log('Usage: bitcoin-cli [--testnet] [--host=host] [--port=port] [--rpcuser=user --rpcpassword=pass] method args');
}