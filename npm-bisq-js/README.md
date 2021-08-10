# Bisq**JS** API

[![npm version](https://img.shields.io/npm/v/@mempool/bisq.js.svg?style=flat-square)](https://www.npmjs.org/package/@mempool/bisq.js)
[![NPM](https://img.shields.io/david/mempool/bisq.js.svg?style=flat-square)](https://david-dm.org/mempool/bisq.js#info=dependencies)
[![Known Vulnerabilities](https://snyk.io/test/github/mempool/bisq.js/badge.svg?style=flat-square)](https://snyk.io/test/github/mempool/bisq.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

NPM package module for Bisq APIs.

Documentation: [https://bisq.markets/api](https://bisq.markets/api)

## **Installation**

### **ES Modules**

Install the npm module.

```bash
# npm
$ npm install @mempool/bisq.js --save

# yarn
$ yarn add @mempool/bisq.js
```

Or if you're not into package management, just [download a ZIP](https://github.com/mempool/mempool.js/archive/refs/heads/main.zip) file.

Import the module.

```js
import bisqJS from '@mempool/bisq.js';

const bisq = bisqJS();
```

### **CommonJS**

Include the line below in the `head` tag of your html file.

```html
<script type="text/javascript" src="https://bisq.markets/bisq.js"></script>
```

Call `bisqJS()` function to access the API methods.

```js
const bisq = bisqJS();
```

---

## **Features**

- [Addresses](./README-bisq.md#get-address)
- [Blocks](./README-bisq.md#get-blocks)
- [Markets](./README-bisq.md#get-markets)
- [Statistics](./README-bisq.md#get-statistics)
- [Transactions](./README-bisq.md#get-transactions)
---

## **Contributing**

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## **License** [MIT](https://choosealicense.com/licenses/mit/)
