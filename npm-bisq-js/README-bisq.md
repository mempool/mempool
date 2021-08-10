# Bisq**JS** - Features

Interface to access the Bisq API.

[Back to home](./README.md)

---

## **Features**

- Addresses
  - [Get Address](#get-address)
- Blocks
  - [Get Block](#get-block)
  - [Get Blocks](#get-blocks)
  - [Get Block Tip Height](#get-block-tip-height)
- Markets
  - [Get Currencies](#get-currencies)
  - [Get Depth](#get-depth)
  - [Get HLOC](#get-hloc)
  - [Get Markets](#get-markets)
  - [Get Offers](#get-offers)
  - [Get Ticker](#get-ticker)
  - [Get Trades](#get-trades)
  - [Get Volumes](#get-volumes)
- Statistics
  - [Get Statistics](#get-statistics)
- Transactions
  - [Get Transaction](#get-transaction)
  - [Get Transactions](#get-transactions)

---

### **Get Address**

Returns statistics about all Bisq transactions.

[ [NodeJS Example](../examples/nodejs/bisq-js/addresses.ts) ] [ [HTML Example](../examples/html/bisq-js/addresses.html) ] [ [Top](#features) ]

```js
const { addresses } = bisqJS();

const address = 'B1DgwRN92rdQ9xpEVCdXRfgeqGw9X4YtrZz';

const myAddress = await addresses.getAddress({ address });
console.log(myAddress);
```

### **Get Block**

Returns all Bisq transactions that exist in a Bitcoin block.

**Parameters:**

- {string} hash

[ [NodeJS Example](../examples/nodejs/bisq-js/blocks.ts) ] [ [HTML Example](../examples/html/bisq-js/blocks.html) ] [ [Top](#features) ]

```js
const { blocks } = bisqJS();

const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

const block = await blocks.getBlock({ hash });
console.log(block);
```

### **Get Blocks**

Returns `:length` Bitcoin blocks that contain Bisq transactions, starting from `:index`.

**Parameters:**

- {number} index
- {number} length

[ [NodeJS Example](../examples/nodejs/bisq-js/blocks.ts) ] [ [HTML Example](../examples/html/bisq-js/blocks.html) ] [ [Top](#features) ]

```js
const { blocks } = bisqJS();

const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

const myBlocks = await blocks.getBlocks({ index: 0, length: 1 });
console.log(myBlocks);
```

### **Get Blocks Tip Height**

Returns the most recently processed Bitcoin block height processed by Bisq.

[ [NodeJS Example](../examples/nodejs/bisq-js/blocks.ts) ] [ [HTML Example](../examples/html/bisq-js/blocks.html) ] [ [Top](#features) ]

```js
const { blocks } = bisqJS();

const myBlocksHeight = await blocks.getBlocksTipHeight({
  index: 0,
  length: 1,
});
console.log(myBlocksHeight);
```

### **Get Market Currencies**

Returns the Bisq market currencies.

[ [NodeJS Example](../examples/nodejs/bisq-js/markets.ts) ] [ [HTML Example](../examples/html/bisq-js/markets.html) ] [ [Top](#features) ]

```js
const { markets } = bisqJS();

const currencies = await markets.getCurrencies();
console.log(currencies);
```

### **Get Market Depth**

Returns the Bisq market depth.

**Parameters:**

- {string} market

[ [NodeJS Example](../examples/nodejs/bisq-js/markets.ts) ] [ [HTML Example](../examples/html/bisq-js/markets.html) ] [ [Top](#features) ]

```js
const { markets } = bisqJS();
const market = "BTC_USD";

const depth = await markets.getDepth({ market });
console.log(depth)
```

### **Get Market HLOC**

Returns the Bisq market Hloc.

**Parameters:**

- {string} market

[ [NodeJS Example](../examples/nodejs/bisq-js/markets.ts) ] [ [HTML Example](../examples/html/bisq-js/markets.html) ] [ [Top](#features) ]

```js
const { markets } = bisqJS();
const market = "BTC_USD";

const hloc = await markets.getHloc({ market });
console.log(hloc);
```

### **Get Market Offers**

Returns the Bisq market Offers.

**Parameters:**

- {string} market

[ [NodeJS Example](../examples/nodejs/bisq-js/markets.ts) ] [ [HTML Example](../examples/html/bisq-js/markets.html) ] [ [Top](#features) ]

```js
const { markets } = bisqJS();
const market = "BTC_USD";

const offers = await markets.getOffers({ market });
console.log(offers);
```

### **Get Market Ticker**

Returns the Bisq market Ticker.

**Parameters:**

- {string} market

[ [NodeJS Example](../examples/nodejs/bisq-js/markets.ts) ] [ [HTML Example](../examples/html/bisq-js/markets.html) ] [ [Top](#features) ]

```js
const { markets } = bisqJS();
const market = "BTC_USD";

const ticker = await markets.getTicker({ market });
console.log(ticker);
```

### **Get Market Trades**

Returns the Bisq market Trades.

**Parameters:**

- {string} market

[ [NodeJS Example](../examples/nodejs/bisq-js/markets.ts) ] [ [HTML Example](../examples/html/bisq-js/markets.html) ] [ [Top](#features) ]

```js
const { markets } = bisqJS();
const market = "BTC_USD";

const trades = await markets.getTrades({ market });
console.log(trades);
```

### **Get Market Volumes**

Returns the Bisq market Volumes.

**Parameters:**

- {string} market

[ [NodeJS Example](../examples/nodejs/bisq-js/markets.ts) ] [ [HTML Example](../examples/html/bisq-js/markets.html) ] [ [Top](#features) ]

```js
const { markets } = bisqJS();
const market = "BTC_USD";
const basecurrency = "BTC";

const volumes = await markets.getVolumes({ basecurrency, market });
console.log(volumes);
```

### **Get Stats**

Returns statistics about all Bisq transactions.

[ [NodeJS Example](../examples/nodejs/bisq-js/statistics.ts) ] [ [HTML Example](../examples/html/bisq-js/statistics.html) ] [ [Top](#features) ]

```js
const { statistics } = bisqJS();

const stats = await statistics.getStats();
console.log(stats);
```

### **Get Transaction**

Returns details about a Bisq transaction.

[ [NodeJS Example](../examples/nodejs/bisq-js/transactions.ts) ] [ [HTML Example](../examples/html/bisq-js/transactions.html) ] [ [Top](#features) ]

```js
const { transactions } = bisqJS();

const txid = '4b5417ec5ab6112bedf539c3b4f5a806ed539542d8b717e1c4470aa3180edce5';

const tx = await transactions.getTx({ txid });
console.log(tx);
```

### **Get Transactions**

Returns details about a Bisq transactions.

[ [NodeJS Example](../examples/nodejs/bisq-js/transactions.ts) ] [ [HTML Example](../examples/html/bisq-js/transactions.html) ] [ [Top](#features) ]

```js
const { transactions } = bisqJS();

const txs = await transactions.getTxs({ index: 0, length: 1 });
console.log(txs);
```
