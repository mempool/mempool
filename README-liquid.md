# mempool**JS** - Bitcoin API

Interface to access the Bitcoin `mainet`, `testnet`, `signet` APIs.

[Back to home](./README.md)

---

## **Features**

- [Bitcoin](./README-bitcoin.md)
- [Bisq](./README-bisq.md)
- Liquid
  - Addresses
    - [Get Address](#get-address)
    - [Get Address Txs](#get-address-txs)
    - [Get Address Txs Chain](#get-address-txs-chain)
    - [Get Address Txs Mempool](#get-address-txs-mempool)
    - [Get Address Txs Utxo](#get-address-txs-utxo)
  - Assets
    - [Get Asset](#get-asset)
    - [Get Asset Txs](#get-asset-txs)
    - [Get Asset Supply](#get-asset-supply)
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
  - Websocket
    - [Websocket Client](#websocket-client)
    - [Websocket Server](#websocket-server)

---

### **Get Address**

Returns details about an address. Available fields: `address`, `chain_stats`, and `mempool_stats`. `{chain,mempool}\_stats` each contain an object with `tx_count`, `funded_txo_count`, `funded_txo_sum`, `spent_txo_count`, and `spent_txo_sum`.

**Parameters:**

- {string} address

[ [NodeJS Example](examples/nodejs/liquid/addresses.ts) ] [ [HTML Example](examples/html/liquid/addresses.html) ] [ [Top](#features) ]

```js
const {
  liquid: { addresses },
} = mempoolJS();

const address = '1wizSAYSbuyXbt9d8JV8ytm5acqq2TorC';

const myAddress = await addresses.getAddress({ address });
console.log(myAddress);
```

### **Get Address Txs**

Get transaction history for the specified address/scripthash, sorted with newest first. Returns up to 50 mempool transactions plus the first 25 confirmed transactions. You can request more confirmed transactions using `:last_seen_txid`.

**Parameters:**

- {string} address

[ [NodeJS Example](examples/nodejs/liquid/addresses.ts) ] [ [HTML Example](examples/html/liquid/addresses.html) ] [ [Top](#features) ]

```js
const {
  liquid: { addresses },
} = mempoolJS();

const address = '1wizSAYSbuyXbt9d8JV8ytm5acqq2TorC';

const addressTxs = await addresses.getAddressTxs({ address });
console.log(addressTxs);
```

### **Get Address Txs Chain**

Get confirmed transaction history for the specified address/scripthash, sorted with newest first. Returns 25 transactions per page. More can be requested by specifying the last txid seen by the previous query.

**Parameters:**

- {string} address

[ [NodeJS Example](examples/nodejs/liquid/addresses.ts) ] [ [HTML Example](examples/html/liquid/addresses.html) ] [ [Top](#features) ]

```js
const {
  liquid: { addresses },
} = mempoolJS();

const address = '1wizSAYSbuyXbt9d8JV8ytm5acqq2TorC';

const addressTxsChain = await addresses.getAddressTxsChain({ address });
console.log(addressTxsChain);
```

### **Get Address Txs Mempool**

Get unconfirmed transaction history for the specified `address/scripthash`. Returns up to 50 transactions (no paging).

**Parameters:**

- {string} address

[ [NodeJS Example](examples/nodejs/liquid/addresses.ts) ] [ [HTML Example](examples/html/liquid/addresses.html) ] [ [Top](#features) ]

```js
const {
  liquid: { addresses },
} = mempoolJS();

const address = '1wizSAYSbuyXbt9d8JV8ytm5acqq2TorC';

const addressTxsMempool = await addresses.getAddressTxsMempool({ address });
console.log(addressTxsMempool);
```

### **Get Address Txs Utxo**

Get the list of unspent transaction outputs associated with the `address/scripthash`. Available fields: `txid`, `vout`, `value`, and `status` (with the status of the funding tx).

**Parameters:**

- {string} address

[ [NodeJS Example](examples/nodejs/liquid/addresses.ts) ] [ [HTML Example](examples/html/liquid/addresses.html) ] [ [Top](#features) ]

```js
const { addresses } = mempoolJS();

const addressTxsUtxo = await addresses.getAddressTxsUtxo('15e10745f15593a...');
console.log(addressTxsUtxo);
```

### **Get Asset**

Returns information about a Liquid asset.

**Parameters:**

- {string} asset_id

[ [NodeJS Example](examples/nodejs/liquid/addresses.ts) ] [ [HTML Example](examples/html/liquid/addresses.html) ] [ [Top](#features) ]

```js
const {
  liquid: { assets },
} = mempoolJS();

const asset_id =
  '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';

const asset = await assets.getAsset({ asset_id });
console.log(asset);
```

### **Get Asset Txs**

Returns transactions associated with the specified Liquid asset. For the network's native asset, returns a list of peg in, peg out, and burn transactions. For user-issued assets, returns a list of issuance, reissuance, and burn transactions. Does not include regular transactions transferring this asset.

**Parameters:**

- {string} asset_id
- {boolean} is_mempool

[ [NodeJS Example](examples/nodejs/liquid/addresses.ts) ] [ [HTML Example](examples/html/liquid/addresses.html) ] [ [Top](#features) ]

```js
const {
  liquid: { assets },
} = mempoolJS();

const asset_id =
  '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';

const assetTxs = await assets.getAssetTxs({ asset_id, is_mempool: false });
console.log(assetTxs);
```

### **Get Asset Supply**

Get the current total supply of the specified asset. For the native asset (L-BTC), this is calculated as `[chain,mempool]\_stats.peg_in_amount` - `[chain,mempool]\_stats.peg_out_amount` - `[chain,mempool]\_stats.burned_amount`. For issued assets, this is calculated as `[chain,mempool]\_stats.issued_amount` - `[chain,mempool]\_stats.burned_amount`. Not available for assets with blinded issuances. If `/decimal` is specified, returns the supply as a decimal according to the asset's divisibility. Otherwise, returned in base units.

**Parameters:**

- {string} asset_id
- {boolean} decimal

[ [NodeJS Example](examples/nodejs/liquid/addresses.ts) ] [ [HTML Example](examples/html/liquid/addresses.html) ] [ [Top](#features) ]

```js
const {
  liquid: { assets },
} = mempoolJS();

const asset_id =
  '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';

const assetSupply = await assets.getAssetSupply({ asset_id, decimal: false });
console.log(assetSupply);
```

### **Get Block**

Returns details about a block. Available fields: `id`, `height`, `version`, `timestamp`, `bits`, `nonce`, `merkle_root`, `tx_count`, `size`, `weight`, and `previousblockhash`.

**Parameters:**

- {string} hash

[ [NodeJS Example](examples/nodejs/liquid/blocks.ts) ] [ [HTML Example](examples/html/liquid/blocks.html) ] [ [Top](#features) ]

```js
const {
  liquid: { blocks },
} = mempoolJS();

const hash = '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

const block = await blocks.getBlock({ hash });
console.log(block);
```

### **Get Block Status**

Returns the confirmation status of a block. Available fields: `in_best_chain` (boolean, false for orphaned blocks), `next_best` (the hash of the next block, only available for blocks in the best chain).

**Parameters:**

- {string} hash

[ [NodeJS Example](examples/nodejs/liquid/blocks.ts) ] [ [HTML Example](examples/html/liquid/blocks.html) ] [ [Top](#features) ]

```js
const {
  liquid: { blocks },
} = mempoolJS();

const hash = '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

const blockStatus = await blocks.getBlockStatus({ hash });
console.log(blockStatus);
```

### **Get Block Txs**

Returns a list of transactions in the block (up to 25 transactions beginning at start_index). Transactions returned here do not have the status field, since all the transactions share the same block and confirmation status.

**Parameters:**

- {string} hash
- {number} start_index

[ [NodeJS Example](examples/nodejs/liquid/blocks.ts) ] [ [HTML Example](examples/html/liquid/blocks.html) ] [ [Top](#features) ]

```js
const {
  liquid: { blocks },
} = mempoolJS();

const hash = '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

const blockTxs = await blocks.getBlockTxs({ hash });
console.log(blockTxs);
```

### **Get Block Txids**

Returns a list of all txids in the block.

**Parameters:**

- {string} hash

[ [NodeJS Example](examples/nodejs/liquid/blocks.ts) ] [ [HTML Example](examples/html/liquid/blocks.html) ] [ [Top](#features) ]

```js
const {
  liquid: { blocks },
} = mempoolJS();

const hash = '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

const blockTxids = await blocks.getBlockTxids({ hash });
console.log(blockTxids);
```

### **Get Block Txid**

Returns the transaction at index :index within the specified block.

**Parameters:**

- {string} hash
- {number} index

[ [NodeJS Example](examples/nodejs/liquid/blocks.ts) ] [ [HTML Example](examples/html/liquid/blocks.html) ] [ [Top](#features) ]

```js
const {
  liquid: { blocks },
} = mempoolJS();

const hash = '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

const blockTxid = await blocks.getBlockTxid({ hash, index: 218 });
console.log(blockTxid);
```

### **Get Block Raw**

Returns the raw block representation in binary.

**Parameters:**

- {string} hash

[ [NodeJS Example](examples/nodejs/liquid/blocks.ts) ] [ [HTML Example](examples/html/liquid/blocks.html) ] [ [Top](#features) ]

```js
const {
  liquid: { blocks },
} = mempoolJS();

const hash = '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

const blockRaw = await blocks.getBlockRaw({ hash });
console.log(blockRaw);
```

### **Get Blocks Height**

Returns the hash of the block currently at `:height`.

**Parameters:**

- {number} height

[ [NodeJS Example](examples/nodejs/liquid/blocks.ts) ] [ [HTML Example](examples/html/liquid/blocks.html) ] [ [Top](#features) ]

```js
const {
  liquid: { blocks },
} = mempoolJS();

const blockHeight = await blocks.getBlockHeight({ height: 0 });
console.log(blockHeight);
```

### **Get Blocks**

Returns the 10 newest blocks starting at the tip or at `:start_height` if specified.

**Parameters:**

- {number} start_height

[ [NodeJS Example](examples/nodejs/liquid/blocks.ts) ] [ [HTML Example](examples/html/liquid/blocks.html) ] [ [Top](#features) ]

```js
const {
  liquid: { blocks },
} = mempoolJS();

const getBlocks = await blocks.getBlocks({ start_height: 9999 });
console.log(getBlocks);
```

### **Get Blocks Tip Height**

Returns the 10 newest blocks starting at the tip or at `:start_height` if specified.

**Parameters:**

- {number} start_height

[ [NodeJS Example](examples/nodejs/liquid/blocks.ts) ] [ [HTML Example](examples/html/liquid/blocks.html) ] [ [Top](#features) ]

```js
const {
  liquid: { blocks },
} = mempoolJS();

const blocksTipHeight = await blocks.getBlocksTipHeight();
console.log(blocksTipHeight);
```

### **Get Blocks Tip Hash**

Returns the hash of the last block.

[ [NodeJS Example](examples/nodejs/liquid/blocks.ts) ] [ [HTML Example](examples/html/liquid/blocks.html) ] [ [Top](#features) ]

```js
const {
  liquid: { blocks },
} = mempoolJS();

const blocksTipHash = await blocks.getBlocksTipHash();
console.log(blocksTipHash);
```

### **Get Fees Recommended**

Returns our currently suggested fees for new transactions.

[ [NodeJS Example](examples/nodejs/liquid/fees.ts) ] [ [HTML Example](examples/html/liquid/fees.html) ] [ [Top](#features) ]

```js
const {
  liquid: { fees },
} = mempoolJS();

const feesRecommended = await fees.getFeesRecommended();
console.log(feesRecommended);
```

### **Get Fees Mempool Blocks**

Returns current mempool as projected blocks.

[ [NodeJS Example](examples/nodejs/liquid/fees.ts) ] [ [HTML Example](examples/html/liquid/fees.html) ] [ [Top](#features) ]

```js
const {
  liquid: { fees },
} = mempoolJS();

const feesMempoolBlocks = await fees.getFeesMempoolBlocks();
console.log(feesMempoolBlocks);
```

### **Get Mempool**

Returns current mempool backlog statistics.

[ [NodeJS Example](examples/nodejs/liquid/mempool.ts) ] [ [HTML Example](examples/html/liquid/mempool.html) ] [ [Top](#features) ]

```js
const {
  liquid: { mempool },
} = mempoolJS();

const getMempool = await mempool.getMempool();
console.log(getMempool);
```

### **Get Mempool Recent**

Get a list of the last 10 transactions to enter the mempool. Each transaction object contains simplified overview data, with the following fields: `txid`, `fee`, `vsize`, and `value`.

[ [NodeJS Example](examples/nodejs/liquid/mempool.ts) ] [ [HTML Example](examples/html/liquid/mempool.html) ] [ [Top](#features) ]

```js
const {
  liquid: { mempool },
} = mempoolJS();

const getMempoolRecent = await mempool.getMempoolRecent();
console.log(getMempoolRecent);
```

### **Get Mempool Txids**

Get the full list of txids in the mempool as an array. The order of the `txids` is arbitrary and does not match bitcoind.

[ [NodeJS Example](examples/nodejs/liquid/mempool.ts) ] [ [HTML Example](examples/html/liquid/mempool.html) ] [ [Top](#features) ]

```js
const {
  liquid: { mempool },
} = mempoolJS();

const getMempoolTxids = await mempool.getMempoolTxids();
console.log(getMempoolTxids);
```

### **Get Tx**

Returns details about a transaction. Available fields: `txid`, `version`, `locktime`, `size`, `weight`, `fee`, `vin`, `vout`, and `status`.

**Parameters:**

- {string} txid

[ [NodeJS Example](examples/nodejs/liquid/transactions.ts) ] [ [HTML Example](examples/html/liquid/transactions.html) ] [ [Top](#features) ]

```js
const {
  liquid: { transactions },
} = mempoolJS();

const txid = '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

const tx = await transactions.getTx({ txid });
console.log(tx);
```

### **Get Tx Status**

Returns the confirmation status of a transaction. Available fields: `confirmed` (boolean), `block_height` (optional), and `block_hash` (optional).

**Parameters:**

- {string} txid

[ [NodeJS Example](examples/nodejs/liquid/transactions.ts) ] [ [HTML Example](examples/html/liquid/transactions.html) ] [ [Top](#features) ]

```js
const {
  liquid: { transactions },
} = mempoolJS();

const txid = '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

const txStatus = await transactions.getTxStatus({ txid });
console.log(txStatus);
```

### **Get Tx Hex**

Returns a transaction serialized as hex.

**Parameters:**

- {string} txid

[ [NodeJS Example](examples/nodejs/liquid/transactions.ts) ] [ [HTML Example](examples/html/liquid/transactions.html) ] [ [Top](#features) ]

```js
const {
  liquid: { transactions },
} = mempoolJS();

const txid = '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

const txHex = await transactions.getTxHex({ txid });
console.log(txHex);
```

### **Get Tx Raw**

Returns a transaction as binary data.

**Parameters:**

- {string} txid

[ [NodeJS Example](examples/nodejs/liquid/transactions.ts) ] [ [HTML Example](examples/html/liquid/transactions.html) ] [ [Top](#features) ]

```js
const {
  liquid: { transactions },
} = mempoolJS();

const txid = '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

const txRaw = await transactions.getTxRaw({ txid });
console.log(txRaw);
```

### **Get Tx Merkle Block Proof**

Returns a merkle inclusion proof for the transaction using bitcoind's merkleblock format.

**Parameters:**

- {string} txid

[ [NodeJS Example](examples/nodejs/liquid/transactions.ts) ] [ [HTML Example](examples/html/liquid/transactions.html) ] [ [Top](#features) ]

```js
const {
  liquid: { transactions },
} = mempoolJS();

const txid = '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

const txMerkleBlockProof = await transactions.getTxMerkleBlockProof({ txid });
console.log(txMerkleBlockProof);
```

### **Get Tx Merkle Proof**

Returns a merkle inclusion proof for the transaction using Electrum's blockchain.transaction.get_merkle format.

**Parameters:**

- {string} txid

[ [NodeJS Example](examples/nodejs/liquid/transactions.ts) ] [ [HTML Example](examples/html/liquid/transactions.html) ] [ [Top](#features) ]

```js
const {
  liquid: { transactions },
} = mempoolJS();

const txid = '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

const txMerkleProof = await transactions.getTxMerkleProof({ txid });
console.log(txMerkleProof);
```

### **Get Tx Outspend**

Returns the spending status of a transaction output. Available fields: `spent` (boolean), `txid` (optional), `vin` (optional), and `status` (optional, the status of the spending tx).

**Parameters:**

- {string} txid
- {number} vout

[ [NodeJS Example](examples/nodejs/liquid/transactions.ts) ] [ [HTML Example](examples/html/liquid/transactions.html) ] [ [Top](#features) ]

```js
const {
  liquid: { transactions },
} = mempoolJS();

const txid = '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

const txOutspend = await transactions.getTxOutspend({
  txid,
  vout: 3,
});
console.log(txOutspend);
```

### **Get Tx Outspends**

Returns the spending status of all transaction outputs.

**Parameters:**

- {string} txid

[ [NodeJS Example](examples/nodejs/liquid/transactions.ts) ] [ [HTML Example](examples/html/liquid/transactions.html) ] [ [Top](#features) ]

```js
const {
  liquid: { transactions },
} = mempoolJS();

const txid = '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

const txOutspends = await transactions.getTxOutspends({ txid });
console.log(txOutspends);
```

### **Post Tx Outspends**

Broadcast a raw transaction to the network. The transaction should be provided as hex in the request body. The `txid` will be returned on success.

**Parameters:**

- {string} txid

[ [NodeJS Example](examples/nodejs/liquid/transactions.ts) ] [ [HTML Example](examples/html/liquid/transactions.html) ] [ [Top](#features) ]

```js
const {
  liquid: { transactions },
} = mempoolJS();

const txid = '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

const postTx = await transactions.postTx({ txid });
console.log(postTx);
```

### **Websocket**

Default push: `{ action: 'want', data: ['blocks', ...] }` to express what you want pushed. Available: blocks, mempool-block, live-2h-chart, and stats.

Push transactions related to address: `{ 'track-address': '3PbJ...bF9B' }` to receive all new transactions containing that address as input or output. Returns an array of transactions. address-transactions for new mempool transactions, and block-transactions for new block confirmed transactions.

[ [NodeJS Example](examples/nodejs/liquid/websocket.ts) ] [ [HTML Example](examples/html/liquid/websocket.html) ] [ [Top](#features) ]

#### **Websocket Server**

Only use on server side apps.

```js
const { liquid: { websocket } } = mempoolJS();

const init = async () => {
  
  const ws = websocket.initServer({
    options: ["blocks", "stats", "mempool-blocks", "live-2h-chart"],
  });
  
  ws.on("message", function incoming(data) {
    const res = JSON.parse(data.toString());
    if (res.blocks) {
      console.log(res.blocks);
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
}
init();
```

#### **Websocket Client**

Only use on browser apps.

```js
const init = async () => {
  const {
    liquid: { websocket },
  } = mempoolJS();
  
  const ws = websocket.initClient({
    options: ['blocks', 'stats', 'mempool-blocks', 'live-2h-chart'],
  });

  ws.addEventListener('message', function incoming({data}) {
    const res = JSON.parse(data.toString());
    if (res.blocks) {
      console.log(res.blocks);
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
};
init();
```