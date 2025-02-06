# bitcoin-core
A modern Bitcoin Core REST and RPC client to execute administrative tasks, [multiwallet](https://bitcoincore.org/en/2017/09/01/release-0.15.0/#multiwallet) operations and queries about network and the blockchain.

## Status
[![npm version][npm-image]][npm-url] [![build status][travis-image]][travis-url]

## Installation

Install the package via `yarn`:

```sh
yarn add bitcoin-core
```

or via `npm`:

Install the package via `npm`:

```sh
npm install bitcoin-core --save
```

## Usage
### Client(...args)
#### Arguments
1. `[headers={}]` _(object)_: Custom request headers.
2. `[host=http://localhost:8332]` _(string)_: The host to connect to.
3. `[logger=debugnyan('bitcoin-core')]` _(Function)_: Custom logger (by default, `debugnyan`).
4. `[password]` _(string)_: The RPC server user password.
5. `[timeout=30000]` _(number)_: How long until the request times out (ms).
6. `[username]` _(number)_: The RPC server user name.
7. `[version]` _(string)_: Which version to check methods for ([read more](#versionchecking)).
8. `[wallet]` _(string)_: Which wallet to manage ([read more](#multiwallet)).

### Examples

#### Using promises to process the response

```js
client.getInfo().then((help) => console.log(help));
```

#### Using callbacks to process the response

Callback support was removed. Since every method returns a `Promise`, [callbackify()](https://nodejs.org/api/util.html#util_util_callbackify_original) (`>node@v8.2.0`) can be used, or for older `node` versions you can use the npm package [callbackify](https://www.npmjs.com/package/callbackify).

```js
util.callbackify(() => client.getInfo())((error, help) => console.log(help));
```

## Named parameters

Since version v0.14.0, it is possible to send commands via the JSON-RPC interface using named parameters instead of positional ones. This comes with the advantage of making the order of arguments irrelevant. It also helps improving the readability of certain function calls when leaving out arguments for their default value.

You **must** provide a version in the client arguments to enable named parameters.

```js
const client = new Client({ version: '0.15.1' });
```
For instance, take the `getBalance()` call written using positional arguments:
```js
const balance = await new Client().getBalance('*', 0);
```

It is functionally equivalent to using the named arguments `account` and `minconf`, leaving out `include_watchonly` (defaults to `false`):

```js
const balance = await new Client({ version: '0.15.1' }).getBalance({
  account: '*',
  minconf: 0
});
```

This feature is available to all JSON-RPC methods that accept arguments.

### Floating point number precision in JavaScript

Due to [JavaScript's limited floating point precision](http://floating-point-gui.de/), all big numbers (numbers with more than 15 significant digits) are returned as strings to prevent precision loss. This includes both the RPC and REST APIs.

## Multiwallet

Since Bitcoin Core v0.15.0, it's possible to manage multiple wallets using a single daemon. This enables use-cases such as managing a personal and a business wallet simultaneously in order to simplify accounting and accidental misuse of funds.

Historically, the _accounts_ feature was supposed to offer similar functionality, but it has now been replaced by this more powerful feature.

To enable Multi Wallet support, start by specifying the number of added wallets you would like to have available and loaded on the server using the `-wallet` argument multiple times. For convenience, the bitcoin-core docker image will be used, but it's not a requirement:

```sh
docker run --rm -it -p 18332:18332 ruimarinho/bitcoin-core:0.15-alpine \
  -printtoconsole \
  -server \
  -rpcauth='foo:e1fcea9fb59df8b0388f251984fe85$26431097d48c5b6047df8dee64f387f63835c01a2a463728ad75087d0133b8e6' \
  -regtest \
  -wallet=wallet1.dat \
  -wallet=wallet2.dat \
  -rpcallowip=172.17.0.0/16
```

Notice the `rpcauth` hash which has been previously generated for the password `j1DuzF7QRUp-iSXjgewO9T_WT1Qgrtz_XWOHCMn_O-Y=`. Do **not** copy and paste this hash **ever** beyond this exercise.

Instantiate a client for each wallet and execute commands targeted at each wallet:

```js
const Client = require('bitcoin-core');

const wallet1 = new Client({
  network: 'regtest',
  wallet: 'wallet1.dat',
  username: 'foo',
  password: 'j1DuzF7QRUp-iSXjgewO9T_WT1Qgrtz_XWOHCMn_O-Y='
});

const wallet2 = new Client({
  network: 'regtest',
  wallet: 'wallet2.dat',
  username: 'foo',
  password: 'j1DuzF7QRUp-iSXjgewO9T_WT1Qgrtz_XWOHCMn_O-Y='
});

(async function() {
  await wallet2.generate(100);

  console.log(await wallet1.getBalance());
  // => 0
  console.log(await wallet2.getBalance());
  // => 50
}());
```


### Version Checking
By default, all methods are exposed on the client independently of the version it is connecting to. This is the most flexible option as defining methods for unavailable RPC calls does not cause any harm and the library is capable of handling a `Method not found` response error correctly.

```js
const client = new Client();

client.command('foobar');
// => RpcError: -32601 Method not found
```

However, if you prefer to be on the safe side, you can enable strict version checking. This will validate all method calls before executing the actual RPC request:

```js
const client = new Client({ version: '0.12.0' });

client.getHashesPerSec();
// => Method "gethashespersec" is not supported by version "0.12.0"
```

If you want to enable strict version checking for the bleeding edge version, you may set a very high version number to exclude recently deprecated calls:

```js
const client = new Client({ version: `${Number.MAX_SAFE_INTEGER}.0.0` });

client.getWork();
// => Throws 'Method "getwork" is not supported by version "9007199254740991.0.0"'.
```

To avoid potential issues with prototype references, all methods are still enumerable on the library client prototype.

### RPC
Start the `bitcoind` with the RPC server enabled and optionally configure a username and password:

```sh
docker run --rm -it ruimarinho/bitcoin-core:0.12-alpine -printtoconsole -rpcuser=foo -rpcpassword=bar -server
```

These configuration values may also be set on the `bitcoin.conf` file of your platform installation.

The RPC services binds to the localhost loopback network interface, so use `rpcbind` to change where to bind to and `rpcallowip` to whitelist source IP access.

#### Methods
All RPC [methods](src/methods.js) are exposed on the client interface as a camelcase'd version of those available on `bitcoind` (see examples below).

For a more complete reference about which methods are available, check the [RPC documentation](https://bitcoin.org/en/developer-reference#remote-procedure-calls-rpcs) on the [Bitcoin Core Developer Reference website](https://bitcoin.org/en/developer-reference).

##### Examples

```js
client.createRawTransaction([{ txid: '1eb590cd06127f78bf38ab4140c4cdce56ad9eb8886999eb898ddf4d3b28a91d', vout: 0 }], { 'mgnucj8nYqdrPFh2JfZSB1NmUThUGnmsqe': 0.13 });
client.sendMany('test1', { mjSk1Ny9spzU2fouzYgLqGUD8U41iR35QN: 0.1, mgnucj8nYqdrPFh2JfZSB1NmUThUGnmsqe: 0.2 }, 6, 'Example Transaction');
client.sendToAddress('mmXgiR6KAhZCyQ8ndr2BCfEq1wNG2UnyG6', 0.1,  'sendtoaddress example', 'Nemo From Example.com');
```

#### Batch requests
Batch requests are support by passing an array to the `command` method with a `method` and optionally, `parameters`. The return value will be an array with all the responses.

```js
const batch = [
  { method: 'getnewaddress', parameters: [] },
  { method: 'getnewaddress', parameters: [] }
]

new Client().command(batch).then((responses) => console.log(responses)));

// Or, using ES2015 destructuring.
new Client().command(batch).then(([firstAddress, secondAddress]) => console.log(firstAddress, secondAddress)));
```

Note that batched requests will only throw an error if the batch request itself cannot be processed. However, each individual response may contain an error akin to an individual request.

```js
const batch = [
  { method: 'foobar', parameters: [] },
  { method: 'getnewaddress', parameters: [] }
]

new Client().command(batch).then(([address, error]) => console.log(address, error)));
// => `mkteeBFmGkraJaWN5WzqHCjmbQWVrPo5X3, { [RpcError: Method not found] message: 'Method not found', name: 'RpcError', code: -32601 }`.
```

### REST
Support for the REST interface is still **experimental** and the API is still subject to change. These endpoints are also **unauthenticated** so [there are certain risks which you should be aware](https://github.com/bitcoin/bitcoin/blob/master/doc/REST-interface.md#risks), specifically of leaking sensitive data of the node if not correctly protected.

Error handling is still fragile so avoid passing user input.

Start the `bitcoind` with the REST server enabled:

```sh
docker run --rm -it ruimarinho/bitcoin-core:0.12-alpine -printtoconsole -server -rest
```

These configuration values may also be set on the `bitcoin.conf` file of your platform installation. Use `txindex=1` if you'd like to enable full transaction query support (note: this will take a considerable amount of time on the first run).

### Methods

Unlike RPC methods which are automatically exposed on the client, REST ones are handled individually as each method has its own specificity. The following methods are supported:

- [getBlockByHash](#getblockbyhashhash-options)
- [getBlockHeadersByHash](#getblockheadersbyhashhash-count-options)
- [getBlockchainInformation](#getblockchaininformation)
- [getMemoryPoolContent](#getmemorypoolcontent)
- [getMemoryPoolInformation](#getmemorypoolinformation)
- [getTransactionByHash](#gettransactionbyhashhash-options)
- [getUnspentTransactionOutputs](#getunspenttransactionoutputsoutpoints-options)

#### getBlockByHash(hash, [options])
Given a block hash, returns a block, in binary, hex-encoded binary or JSON formats.

##### Arguments
1. `hash` _(string)_: The block hash.
2. `[options]` _(Object)_: The options object.
3. `[options.extension=json]` _(string)_: Return in binary (`bin`), hex-encoded binary (`hex`) or JSON (`json`) format.

##### Example

```js
client.getBlockByHash('0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206', { extension: 'json' });
```

#### getBlockHeadersByHash(hash, count, [options])
Given a block hash, returns amount of block headers in upward direction.

##### Arguments
1. `hash` _(string)_: The block hash.
2. `count` _(number)_: The number of blocks to count in upward direction.
3. `[options]` _(Object)_: The options object.
4. `[options.extension=json]` _(string)_: Return in binary (`bin`), hex-encoded binary (`hex`) or JSON (`json`) format.

##### Example

```js
client.getBlockHeadersByHash('0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206', 1, { extension: 'json' });
```

#### getBlockchainInformation()
Returns various state info regarding block chain processing.

##### Example

```js
client.getBlockchainInformation();
```

#### getMemoryPoolContent()
Returns transactions in the transaction memory pool.

##### Example

```js
client.getMemoryPoolContent();
```

#### getMemoryPoolInformation()
Returns various information about the transaction memory pool. Only supports JSON as output format.
- size: the number of transactions in the transaction memory pool.
- bytes: size of the transaction memory pool in bytes.
- usage: total transaction memory pool memory usage.

##### Example

```js
client.getMemoryPoolInformation();
```

#### getTransactionByHash(hash, [options])
Given a transaction hash, returns a transaction in binary, hex-encoded binary, or JSON formats.

#### Arguments
1. `hash` _(string)_: The transaction hash.
2. `[options]` _(Object)_: The options object.
3. `[options.summary=false]` _(boolean)_: Whether to return just the transaction hash, thus saving memory.
4. `[options.extension=json]` _(string)_: Return in binary (`bin`), hex-encoded binary (`hex`) or JSON (`json`) format.

##### Example

```js
client.getTransactionByHash('b4dd08f32be15d96b7166fd77afd18aece7480f72af6c9c7f9c5cbeb01e686fe', { extension: 'json', summary: false });
```

#### getUnspentTransactionOutputs(outpoints, [options])
Query unspent transaction outputs (UTXO) for a given set of outpoints. See [BIP64](https://github.com/bitcoin/bips/blob/master/bip-0064.mediawiki) for input and output serialisation.

#### Arguments
1. `outpoints` _(array\<Object\>|Object)_: The outpoint to query in the format `{ id: '<txid>', index: '<index>' }`.
2. `[options]` _(Object)_: The options object.
3. `[options.extension=json]` _(string)_: Return in binary (`bin`), hex-encoded binary (`hex`) or JSON (`json`) format.

##### Example

```js
client.getUnspentTransactionOutputs([{
  id: '0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206',
  index: 0
}, {
  id: '0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206',
  index: 1
}], { extension: 'json' })
```

#### Connecting via SSL
Deprecated since release 0.5.0.

## Logging

By default, all requests made with `bitcoin-core` are logged using [uphold/debugnyan](https://github.com/uphold/debugnyan) with `bitcoin-core` as the logging namespace.

Please note that all sensitive data is obfuscated before calling the logger.

#### Example

Example output defining the environment variable `DEBUG=bitcoin-core`:

```javascript
const client = new Client();

client.getTransactionByHash('b4dd08f32be15d96b7166fd77afd18aece7480f72af6c9c7f9c5cbeb01e686fe');

// {
//   "name": "bitcoin-core",
//   "hostname": "localhost",
//   "pid": 57908,
//   "level": 20,
//   "request": {
//     "headers": {
//       "host": "localhost:8332",
//       "accept": "application/json"
//     },
//     "id": "82cea4e5-2c85-4284-b9ec-e5876c84e67c",
//     "method": "GET",
//     "type": "request",
//     "uri": "http://localhost:8332/rest/tx/b4dd08f32be15d96b7166fd77afd18aece7480f72af6c9c7f9c5cbeb01e686fe.json"
//   },
//   "msg": "Making request 82cea4e5-2c85-4284-b9ec-e5876c84e67c to GET http://localhost:8332/rest/tx/b4dd08f32be15d96b7166fd77afd18aece7480f72af6c9c7f9c5cbeb01e686fe.json",
//   "time": "2017-02-07T14:40:35.020Z",
//   "v": 0
// }
```

### Custom logger

A custom logger can be passed via the `logger` option and it should implement [bunyan's log levels](https://github.com/trentm/node-bunyan#levels).

## Tests
Currently the test suite is tailored for Docker (including `docker-compose`) due to the multitude of different `bitcoind` configurations that are required in order to get the test suite passing.

To test using a local installation of `node.js` but with dependencies (e.g. `bitcoind`) running inside Docker:

```sh
npm run dependencies
npm test
```

To test using Docker exclusively (similarly to what is done in Travis CI):

```sh
npm run testdocker
```

## Release

```sh
npm version [<newversion> | major | minor | patch] -m "Release %s"
```

## License
MIT

[npm-image]: https://img.shields.io/npm/v/bitcoin-core.svg?style=flat-square
[npm-url]: https://npmjs.org/package/bitcoin-core
[travis-image]: https://img.shields.io/travis/ruimarinho/bitcoin-core.svg?style=flat-square
[travis-url]: https://travis-ci.org/ruimarinho/bitcoin-core
