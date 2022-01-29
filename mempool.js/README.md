# Mempool JS API

[![npm version](https://img.shields.io/npm/v/@mempool/mempool.js.svg?style=flat-square)](https://www.npmjs.org/package/@mempool/mempool.js)
[![NPM](https://img.shields.io/david/mempool/mempool.js.svg?style=flat-square)](https://david-dm.org/mempool/mempool.js#info=dependencies)
[![Known Vulnerabilities](https://snyk.io/test/github/mempool/mempool.js/badge.svg?style=flat-square)](https://snyk.io/test/github/mempool/mempool.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

NPM package module for Mempool APIs.

Documentation: [https://mempool.space/api](https://mempool.space/api)

---

## **Installation**

### **ES Modules**

Install the npm module.

```bash
# npm
$ npm install @mempool/mempool.js --save

# yarn
$ yarn add @mempool/mempool.js
```

Or if you're not into package management, just [download a ZIP](https://github.com/mempool/mempool.js/archive/refs/heads/main.zip) file.

Import the module.

```js
import mempoolJS from '@mempool/mempool.js';

// default mempool.space endpoints
const { bitcoin, bisq, liquid } = mempoolJS();

// (optional) your custom endpoints
const { bitcoin, bisq, liquid } = mempoolJS({
  hostname: 'mempool.space', 
  network: 'testnet' // 'signet' | 'testnet' | 'mainnet'
});
```

### **CommonJS**

Include the line below in the `head` tag of your html file.

```html
<script type="text/javascript" src="https://mempool.space/mempool.js"></script>
```

Call `mempoolJS()` function to access the API methods.

```js
// default mempool.space endpoints
const { bitcoin, bisq, liquid } = mempoolJS();

// (optional) your custom endpoints
const { bitcoin, bisq, liquid } = mempoolJS({
  hostname: 'mempool.space',
  network: 'testnet' // 'signet' | 'testnet' | 'mainnet'
});
```

---

## **Features**

- [Bitcoin](./README-bitcoin.md)
  - [Addresses](./README-bitcoin.md#get-address)
  - [Blocks](./README-bitcoin.md#get-blocks)
  - [Difficulty Adjustment](./README-bitcoin.md#get-difficulty-adjustment)
  - [Fees](./README-bitcoin.md#get-fees)
  - [Mempool](./README-bitcoin.md#get-mempool)
  - [Transactions](./README-bitcoin.md#get-transactions)
  - [Websocket Client](./README-bitcoin.md#Websocket-Client)
  - [Websocket Server](./README-bitcoin.md#Websocket-Server)
- [Bisq](./README-bisq.md#get-address)
  - [Addresses](./README-bisq.md#get-address)
  - [Blocks](./README-bisq.md#get-blocks)
  - [Statistics](./README-bisq.md#get-statistics)
  - [Transactions](./README-bisq.md#get-transactions)
- [Liquid](./README-liquid.md#get-address)
  - [Addresses](./README-liquid.md#get-address)
  - [Assets](./README-liquid.md#get-address)
  - [Blocks](./README-liquid.md#get-address)
  - [Fees](./README-liquid.md#get-address)
  - [Mempool](./README-liquid.md#get-address)
  - [Transactions](./README-liquid.md#get-address)
  - [Websocket Client](./README-liquid.md#Websocket-Client)
  - [Websocket Server](./README-liquid.md#Websocket-Server)

---

## **Contributing**

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## **License** [MIT](https://choosealicense.com/licenses/mit/)
