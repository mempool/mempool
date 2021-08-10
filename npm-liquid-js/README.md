# Liquid**JS** API

[![npm version](https://img.shields.io/npm/v/@mempool/liquid.js.svg?style=flat-square)](https://www.npmjs.org/package/@mempool/liquid.js)
[![NPM](https://img.shields.io/david/mempool/liquid.js.svg?style=flat-square)](https://david-dm.org/mempool/liquid.js#info=dependencies)
[![Known Vulnerabilities](https://snyk.io/test/github/mempool/liquid.js/badge.svg?style=flat-square)](https://snyk.io/test/github/mempool/liquid.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

NPM package module for Liquid Network APIs.

Documentation: [https://liquid.network/api](https://liquid.network/api)

## **Installation**

### **ES Modules**

Install the npm module.

```bash
# npm
$ npm install @mempool/liquid.js --save

# yarn
$ yarn add @mempool/liquid.js
```

Or if you're not into package management, just [download a ZIP](https://github.com/mempool/mempool.js/archive/refs/heads/main.zip) file.

Import the module.

```js
import liquidJS from '@mempool/liquid.js';

const liquid = liquidJS();
```

### **CommonJS**

Include the line below in the `head` tag of your html file.

```html
<script type="text/javascript" src="https://liquid.network/liquid.js"></script>
```

Call `liquidJS()` function to access the API methods.

```js
const liquid = liquidJS();
```

---

## **Features**

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
