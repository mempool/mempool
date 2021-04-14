# mempool**JS** - Bisq API

Interface to access the Bisq API.

[Back to home](./README-bitcoin.md)

---

## **Features**

- [Bitcoin](./README-bitcoin.md)
- Bisq
  - Addresses
    - [Get Address](#get-address)
  - Blocks
    - [Get Block](#get-block)
    - [Get Blocks](#get-blocks)
    - [Get Block Tip Height](#get-block-tip-height)
  - Statistics
  - Transactions
    - [Get Transaction](#get-transaction)
    - [Get Transactions](#get-transactions)
- [Liquid](./README-liquid.md)

---

### **Get Address**

Returns statistics about all Bisq transactions.

[ [NodeJS Example](examples/nodejs/bisq/addresses.ts) ] [ [HTML Example](examples/html/bisq/addresses.html) ] [ [Top](#features) ]

```js
const {
  bisq: { addresses },
} = mempoolJS();

const address = 'B1DgwRN92rdQ9xpEVCdXRfgeqGw9X4YtrZz';

const myAddress = await addresses.getAddress({ address });
console.log(myAddress);
```

### **Get Block**

Returns all Bisq transactions that exist in a Bitcoin block.

**Parameters:**

- {string} hash

[ [NodeJS Example](examples/nodejs/bisq/blocks.ts) ] [ [HTML Example](examples/html/bisq/blocks.html) ] [ [Top](#features) ]

```js
const {
  bisq: { blocks },
} = mempoolJS();

const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

const block = await blocks.getBlock({ hash });
console.log(block);
```

### **Get Blocks**

Returns `:length` Bitcoin blocks that contain Bisq transactions, starting from `:index`.

**Parameters:**

- {number} index
- {number} length

[ [NodeJS Example](examples/nodejs/bisq/blocks.ts) ] [ [HTML Example](examples/html/bisq/blocks.html) ] [ [Top](#features) ]

```js
const {
  bisq: { blocks },
} = mempoolJS();

const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

const myBlocks = await blocks.getBlocks({ index: 0, length: 1 });
console.log(myBlocks);
```

### **Get Blocks Tip Height**

Returns the most recently processed Bitcoin block height processed by Bisq.

[ [NodeJS Example](examples/nodejs/bisq/blocks.ts) ] [ [HTML Example](examples/html/bisq/blocks.html) ] [ [Top](#features) ]

```js
const {
  bisq: { blocks },
} = mempoolJS();

const myBlocksHeight = await blocks.getBlocksTipHeight({
  index: 0,
  length: 1,
});
console.log(myBlocksHeight);
```

### **Get Stats**

Returns statistics about all Bisq transactions.

[ [NodeJS Example](examples/nodejs/bisq/statistics.ts) ] [ [HTML Example](examples/html/bisq/statistics.html) ] [ [Top](#features) ]

```js
const {
  bisq: { statistics },
} = mempoolJS();

const stats = await statistics.getStats();
console.log(stats);
```

### **Get Transaction**

Returns details about a Bisq transaction.

[ [NodeJS Example](examples/nodejs/bisq/transactions.ts) ] [ [HTML Example](examples/html/bisq/transactions.html) ] [ [Top](#features) ]

```js
const {
  bisq: { transactions },
} = mempoolJS();

const txid = '4b5417ec5ab6112bedf539c3b4f5a806ed539542d8b717e1c4470aa3180edce5';

const tx = await transactions.getTx({ txid });
console.log(tx);
```

### **Get Transactions**

Returns details about a Bisq transactions.

[ [NodeJS Example](examples/nodejs/bisq/transactions.ts) ] [ [HTML Example](examples/html/bisq/transactions.html) ] [ [Top](#features) ]

```js
const {
  bisq: { transactions },
} = mempoolJS();

const txs = await transactions.getTxs({ index: 0, length: 1 });
console.log(txs);
```
