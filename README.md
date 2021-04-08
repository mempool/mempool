# Mempool JS API

[![npm version](https://img.shields.io/npm/v/mempool-js.svg?style=flat-square)](https://www.npmjs.org/package/mempool-js)
[![NPM](https://img.shields.io/david/mempool/mempool-js.svg?style=flat-square)](https://david-dm.org/mempool/mempool-js#info=dependencies)
[![Known Vulnerabilities](https://snyk.io/test/github/mempool/mempool-js/badge.svg?style=flat-square)](https://snyk.io/test/github/mempool/mempool-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

NPM package module for Mempool JS API.

Documentation: [https://mempool.space/api](https://mempool.space/api)

---

## Features

- [Instalation](#installation)
  - [CommonJS](#commonjs)
  - [NodeJS](#es-modules)
- [Usage](#usage)

  - Addresses
    - [Get Address](#get-address)
    - [Get Address Txs](#get-address-txs)
    - [Get Address Txs Chain](#get-address-txs-chain)
    - [Get Address Txs Mempool](#get-address-txs-mempool)
    - [Get Address Txs Utxo](#get-address-txs-utxo)
  - Blocks
    - [Get Block](#get-block)
    - [Get Block Status](#get-block-status)
    - [Get Block Txs](#get-block-txs)
    - [Get Block Txids](#get-block-txids)
    - [Get Block Txid](#get-block-txid)
    - [Get Block Raw](#get-block-raw)
    - [Get Blocks Height](#get-blocks-height)
    - [Get Blocks](#get-blocks)
    - [Get Blocks Tip Height](#get-blocks-tip-height)
    - [Get Blocks Tip Hash](#get-blocks-tip-hash)
  - Fees
    - [Get Fees Recommended](#get-fees-recommended)
    - [Get Fees Mempool Blocks](#get-fees-mempool-blocks)
  - Mempool
    - [Get Mempool](#get-mempool)
    - [Get Mempool Recent](#get-mempool-recent)
    - [Get Mempool Txids](#get-mempool-txids)
  - Transactions
    - [Get Tx](#get-tx)
    - [Get Tx Status](#get-tx-status)
    - [Get Tx Hex](#get-tx-hex)
    - [Get Tx Raw](#get-tx-raw)
    - [Get Tx Merkle Block Proof](#get-tx-merkle-block-proof)
    - [Get Tx Merkle Proof](#get-tx-merkle-proof)
    - [Get Tx Outspend](#get-tx-outspend)
    - [Get Tx Outspends](#get-tx-outspends)
    - [Post Tx Outspends]($post-tx-outspends)
  - [Websocket](#websocket)

- [Contribute](#contribute)
- [License](#license)

---

## **Installation**

### **ES Modules**

First, install the npm module.

```bash
# npm
$ npm install @mempool/mempool-js --save

# yarn
$ yarn add @mempool/mempool-js
```

Or if you're not into package management, just [download a ZIP](https://github.com/mempool/mempool-js/archive/refs/heads/main.zip) file.

Then import the module.

```js
import mempoolJS from '@mempool/mempool-js';
const {
  addresses,
  blocks,
  fees,
  mempool,
  transactions,
  websocket,
} = mempoolJS();
```

**Custom Endpoints (Optional)**

You can set your custom **API** and **WS** endpoints.

```js
import mempoolJS from '@mempool/mempool-js';

const { address } = mempoolJS({
  apiEndpoint: 'https://mempool.space/api/',
  websocketEndpoint: 'wss://mempool.space/api/v1/ws',
});
```

### **CommonJS**

First, include the script located on the `dist` folder.

```html
<script type="text/javascript" src="./dist/mempool.min.js"></script>
```

Now, you have an access to a variable function to access the API methods.

```js
const {
  addresses,
  blocks,
  fees,
  mempool,
  transactions,
  websocket,
} = mempoolJS();
```

## **Usage**

### **Get Address**

Returns details about an address. Available fields: `address`, `chain_stats`, and `mempool_stats`. `{chain,mempool}\_stats` each contain an object with `tx_count`, `funded_txo_count`, `funded_txo_sum`, `spent_txo_count`, and `spent_txo_sum`.

Parameters:

- {string} address - Address id.

[ [NodeJS Example](examples/nodejs/addresses.ts) ] [ [HTML Example](examples/html/addresses.html) ] [ [Top](#features) ]

```js
const { addresses } = mempoolJS();

const address = await addresses.getAddress('15e10745f15593a...');
console.log(address);
```

### **Get Address Txs**

Get transaction history for the specified address/scripthash, sorted with newest first. Returns up to 50 mempool transactions plus the first 25 confirmed transactions. You can request more confirmed transactions using `:last_seen_txid` (see below).

Parameters:

- {string} address - Address id.

[ [NodeJS Example](examples/nodejs/addresses.ts) ] [ [HTML Example](examples/html/addresses.html) ] [ [Top](#features) ]

```js
const { addresses } = mempoolJS();

const addressTxs = await addresses.getAddressTxs('15e10745f15593a...');
console.log(addressTxs);
```

### **Get Address Txs Chain**

Get confirmed transaction history for the specified address/scripthash, sorted with newest first. Returns 25 transactions per page. More can be requested by specifying the last txid seen by the previous query.

Parameters:

- {string} address - Address id.

[ [NodeJS Example](examples/nodejs/addresses.ts) ] [ [HTML Example](examples/html/addresses.html) ] [ [Top](#features) ]

```js
const { addresses } = mempoolJS();

const addressTxsChain = await addresses.getAddressTxsChain(
  '15e10745f15593a...'
);
console.log(addressTxsChain);
```

### **Get Address Txs Mempool**

Get unconfirmed transaction history for the specified address/scripthash. Returns up to 50 transactions (no paging).

Parameters:

- {string} address - Address id.

[ [NodeJS Example](examples/nodejs/addresses.ts) ] [ [HTML Example](examples/html/addresses.html) ] [ [Top](#features) ]

```js
const { addresses } = mempoolJS();

const addressTxsMempool = await addresses.getAddressTxsMempool(
  '15e10745f15593a...'
);
console.log(addressTxsMempool);
```

### **Get Address Txs Utxo**

Get unconfirmed transaction history for the specified address/scripthash. Returns up to 50 transactions (no paging).

Parameters:

- {string} address - Address id.

[ [NodeJS Example](examples/nodejs/addresses.ts) ] [ [HTML Example](examples/html/addresses.html) ] [ [Top](#features) ]

```js
const { addresses } = mempoolJS();

const addressTxsUtxo = await addresses.getAddressTxsUtxo('15e10745f15593a...');
console.log(addressTxsUtxo);
```

### **Get Block**

Returns details about a block. Available fields: `id`, `height`, `version`, `timestamp`, `bits`, `nonce`, `merkle_root`, `tx_count`, `size`, `weight`, and `previousblockhash`.

Parameters:

- {string} hash - Hash from a block

[ [NodeJS Example](examples/nodejs/blocks.ts) ] [ [HTML Example](examples/html/blocks.html) ] [ [Top](#features) ]

```js
const { blocks } = mempoolJS();

const block = await blocks.getBlock('000000000000000015dc...');
console.log(block);
```

### **Get Block Status**

Returns the confirmation status of a block. Available fields: `in_best_chain` (boolean, false for orphaned blocks), `next_best` (the hash of the next block, only available for blocks in the best chain).

Parameters:

- {string} hash - Hash from a block

[ [NodeJS Example](examples/nodejs/blocks.ts) ] [ [HTML Example](examples/html/blocks.html) ] [ [Top](#features) ]

```js
const { blocks } = mempoolJS();

const blockStatus = await blocks.getBlockStatus('000000000000000015dc...');
console.log(blockStatus);
```

### **Get Block Txs**

Returns a list of transactions in the block (up to 25 transactions beginning at start_index). Transactions returned here do not have the status field, since all the transactions share the same block and confirmation status.

Parameters:

- {Object} params - Params object.
- {string} params.hash - Hash from a block
- {number} params.start_index - Default: 25

[ [NodeJS Example](examples/nodejs/blocks.ts) ] [ [HTML Example](examples/html/blocks.html) ] [ [Top](#features) ]

```js
const { blocks } = mempoolJS();

const blockTxs = await blocks.getBlockTxs({
  hash: '000000000000000015dc...',
});
console.log(blockTxs);
```

### **Get Block Txids**

Returns a list of all txids in the block.

Parameters:

- {string} hash - Hash from a block

[ [NodeJS Example](examples/nodejs/blocks.ts) ] [ [HTML Example](examples/html/blocks.html) ] [ [Top](#features) ]

```js
const { blocks } = mempoolJS();

const blockTxids = await blocks.getBlockTxids('000000000000000015dc...');
console.log(blockTxids);
```

### **Get Block Txid**

Returns the transaction at index :index within the specified block.

Parameters:

- {Object} params - Params object.
- {string} params.hash - Hash from a block
- {number} params.index - Index

[ [NodeJS Example](examples/nodejs/blocks.ts) ] [ [HTML Example](examples/html/blocks.html) ] [ [Top](#features) ]

```js
const { blocks } = mempoolJS();

const blockTxid = await blocks.getBlockTxid({
  hash: '000000000000000015dc...',
  index: 218,
});
console.log(blockTxids);
```

### **Get Block Raw**

Returns the raw block representation in binary.

Parameters:

- {string} hash - Hash from a block

[ [NodeJS Example](examples/nodejs/blocks.ts) ] [ [HTML Example](examples/html/blocks.html) ] [ [Top](#features) ]

```js
const { blocks } = mempoolJS();

const blockRaw = await blocks.getBlockRaw('000000000000000015dc...');
console.log(blockRaw);
```

### **Get Blocks Height**

Returns the hash of the block currently at `:height`.

Parameters:

- {number} height - Height number from a block

[ [NodeJS Example](examples/nodejs/blocks.ts) ] [ [HTML Example](examples/html/blocks.html) ] [ [Top](#features) ]

```js
const { blocks } = mempoolJS();

const blockHeight = await blocks.getBlockHeight(42);
console.log(blockHeight);
```

### **Get Blocks**

Returns the 10 newest blocks starting at the tip or at `:start_height` if specified.

Parameters:

- {Object} params - Params object.
- {number} params.start_height - Height from a block

[ [NodeJS Example](examples/nodejs/blocks.ts) ] [ [HTML Example](examples/html/blocks.html) ] [ [Top](#features) ]

```js
const { blocks } = mempoolJS();

const getBlocks = await blocks.getBlocks({
  start_height: 66666,
});
console.log(getBlocks);
```

### **Get Blocks Tip Height**

Returns the 10 newest blocks starting at the tip or at `:start_height` if specified.

Parameters:

- {Object} params - Params object.
- {number} params.start_height - Height from a block

[ [NodeJS Example](examples/nodejs/blocks.ts) ] [ [HTML Example](examples/html/blocks.html) ] [ [Top](#features) ]

```js
const { blocks } = mempoolJS();

const blocksTipHeight = await blocks.getBlocksTipHeight();
console.log(blocksTipHeight);
```

### **Get Blocks Tip Hash**

Returns the hash of the last block.

[ [NodeJS Example](examples/nodejs/blocks.ts) ] [ [HTML Example](examples/html/blocks.html) ] [ [Top](#features) ]

```js
const { blocks } = mempoolJS();

const blocksTipHash = await blocks.getBlocksTipHash();
console.log(blocksTipHash);
```

### **Get Fees Recommended**

Returns our currently suggested fees for new transactions.

[ [NodeJS Example](examples/nodejs/fees.ts) ] [ [HTML Example](examples/html/fees.html) ] [ [Top](#features) ]

```js
const { fees } = mempoolJS();

const feesRecommended = await fees.getFeesRecommended();
console.log(feesRecommended);
```

### **Get Fees Mempool Blocks**

Returns current mempool as projected blocks.

[ [NodeJS Example](examples/nodejs/fees.ts) ] [ [HTML Example](examples/html/fees.html) ] [ [Top](#features) ]

```js
const { fees } = mempoolJS();

const feesMempoolBlocks = await fees.getFeesMempoolBlocks();
console.log(feesMempoolBlocks);
```

### **Get Mempool**

Returns current mempool backlog statistics.

[ [NodeJS Example](examples/nodejs/mempool.ts) ] [ [HTML Example](examples/html/mempool.html) ] [ [Top](#features) ]

```js
const { mempool } = mempoolJS();

const getMempool = await mempool.getMempool();
console.log(getMempool);
```

### **Get Mempool Txids**

Get the full list of txids in the mempool as an array. The order of the `txids` is arbitrary and does not match bitcoind.

[ [NodeJS Example](examples/nodejs/mempool.ts) ] [ [HTML Example](examples/html/mempool.html) ] [ [Top](#features) ]

```js
const { mempool } = mempoolJS();

const getMempoolTxids = await mempool.getMempoolTxids();
console.log(getMempoolTxids);
```

### **Get Mempool Recent**

Get a list of the last 10 transactions to enter the mempool. Each transaction object contains simplified overview data, with the following fields: `txid`, `fee`, `vsize`, and `value`.

[ [NodeJS Example](examples/nodejs/mempool.ts) ] [ [HTML Example](examples/html/mempool.html) ] [ [Top](#features) ]

```js
const { mempool } = mempoolJS();

const getMempoolRecent = await mempool.getMempoolRecent();
console.log(getMempoolRecent);
```

### **Get Tx**

Returns details about a transaction. Available fields: `txid`, `version`, `locktime`, `size`, `weight`, `fee`, `vin`, `vout`, and `status`.

Parameters:

- {string} txid - Transactions id.

[ [NodeJS Example](examples/nodejs/transactions.ts) ] [ [HTML Example](examples/html/transactions.html) ] [ [Top](#features) ]

```js
const { transactions } = mempoolJS();

const tx = await transactions.getTx('15e10745f15593...');
console.log(tx);
```

### **Get Tx Status**

Returns the confirmation status of a transaction. Available fields: `confirmed` (boolean), `block_height` (optional), and `block_hash` (optional).

Parameters:

- {string} txid - Transactions id.

[ [NodeJS Example](examples/nodejs/transactions.ts) ] [ [HTML Example](examples/html/transactions.html) ] [ [Top](#features) ]

```js
const { transactions } = mempoolJS();

const txStatus = await transactions.getTxStatus('15e10745f15593...');
console.log(txStatus);
```

### **Get Tx Hex**

Returns a transaction serialized as hex.

Parameters:

- {string} txid - Transactions id.

[ [NodeJS Example](examples/nodejs/transactions.ts) ] [ [HTML Example](examples/html/transactions.html) ] [ [Top](#features) ]

```js
const { transactions } = mempoolJS();

const txHex = await transactions.getTxHex('15e10745f15593...');
console.log(txHex);
```

### **Get Tx Raw**

Returns a transaction as binary data.

Parameters:

- {string} txid - Transactions id.

[ [NodeJS Example](examples/nodejs/transactions.ts) ] [ [HTML Example](examples/html/transactions.html) ] [ [Top](#features) ]

```js
const { transactions } = mempoolJS();

const txRaw = await transactions.getTxRaw('15e10745f15593...');
console.log(txRaw);
```

### **Get Tx Merkle Block Proof**

Returns a merkle inclusion proof for the transaction using bitcoind's merkleblock format.

Parameters:

- {string} txid - Transactions id.

[ [NodeJS Example](examples/nodejs/transactions.ts) ] [ [HTML Example](examples/html/transactions.html) ] [ [Top](#features) ]

```js
const { transactions } = mempoolJS();

const txMerkleBlockProof = await transactions.getTxMerkleBlockProof(
  '15e10745f15593...'
);
console.log(txMerkleBlockProof);
```

### **Get Tx Merkle Proof**

Returns a merkle inclusion proof for the transaction using Electrum's blockchain.transaction.get_merkle format.

Parameters:

- {string} txid - Transactions id.

[ [NodeJS Example](examples/nodejs/transactions.ts) ] [ [HTML Example](examples/html/transactions.html) ] [ [Top](#features) ]

```js
const { transactions } = mempoolJS();

const txMerkleProof = await transactions.getTxMerkleProof('15e10745f15593...');
console.log(txMerkleProof);
```

### **Get Tx Outspend**

Returns the spending status of a transaction output. Available fields: `spent` (boolean), `txid` (optional), `vin` (optional), and `status` (optional, the status of the spending tx).

Parameters:

- {Object} params - Params object.
- {string} params.txid - Transactions id.
- {number} params.vout - Vout number.

[ [NodeJS Example](examples/nodejs/transactions.ts) ] [ [HTML Example](examples/html/transactions.html) ] [ [Top](#features) ]

```js
const { transactions } = mempoolJS();

const txOutspend = await transactions.getTxOutspend({
  txid: '15e10745f15593...',
  vout: 3,
});
console.log(txOutspend);
```

### **Get Tx Outspends**

Returns the spending status of all transaction outputs.

Parameters:

- {string} txid - Transactions id.

[ [NodeJS Example](examples/nodejs/transactions.ts) ] [ [HTML Example](examples/html/transactions.html) ] [ [Top](#features) ]

```js
const { transactions } = mempoolJS();

const txOutspends = await transactions.getTxOutspends('15e10745f15593...');
console.log(txOutspends);
```

### **Post Tx Outspends**

Broadcast a raw transaction to the network. The transaction should be provided as hex in the request body. The `txid` will be returned on success.

Parameters:

- {string} txid - Transactions id.

[ [NodeJS Example](examples/nodejs/transactions.ts) ] [ [HTML Example](examples/html/transactions.html) ] [ [Top](#features) ]

```js
const { transactions } = mempoolJS();

const postTx = await transactions.postTx('15e10745f15593...');
console.log(postTx);
```

### **Websocket**

Default push: `{ action: 'want', data: ['blocks', ...] }` to express what you want pushed. Available: blocks, mempool-block, live-2h-chart, and stats.

Push transactions related to address: `{ 'track-address': '3PbJ...bF9B' }` to receive all new transactions containing that address as input or output. Returns an array of transactions. address-transactions for new mempool transactions, and block-transactions for new block confirmed transactions.

[ [NodeJS Example](examples/nodejs/addresses.ts) ] [ [HTML Example](examples/html/addresses.html) ] [ [Top](#features) ]

```js
const { websocket } = mempoolJS();

const ws = websocket.initServer({
  options: ['blocks', 'stats', 'mempool-blocks', 'live-2h-chart'],
});

ws.on('message', function incoming(data) {
  const res = JSON.parse(data.toString());
  if (res.blocks) {
    res.blocks.forEach((block: { height }) => {
      console.log(block.height);
    });
  }
  if (res.mempoolInfo) {
    console.log(res.mempoolInfo);
  }
  if (res.transactions) {
    console.log(res.transactions);
  }
  if (res.mempoolBlocks) {
    console.log(res.mempoolBlocks);
  }
});
```

---

## **Contributing**

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## **License** [MIT](https://choosealicense.com/licenses/mit/)
