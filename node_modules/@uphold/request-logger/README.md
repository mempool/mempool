# request-logger

A wrapper for the [request](https://github.com/request/request) module that logs all request events.

## Status

[![npm version][npm-image]][npm-url] [![build status][travis-image]][travis-url]

## Installation

Install the package via **yarn**:

```shell
❯ yarn add '@uphold/request-logger'
```

Or via **npm**:

```shell
❯ npm install '@uphold/request-logger' --save
```

## Usage

Wrap the `request` module using `@uphold/request-logger`. By default, all events will be logged to `stdout`.

```javascript
const logger = require('@uphold/request-logger');
const request = logger(require('request'));

request.get('https://www.github.com');

// { headers: …,
//   id: '6bfc21a0-0dad-48b2-8378-762e5f85f014',
//   method: 'GET',
//   type: 'request',
//   uri: 'https://www.github.com/' }
// { headers: …,
//   id: '6bfc21a0-0dad-48b2-8378-762e5f85f014',
//   statusCode: 301,
//   type: 'redirect',
//   uri: 'https://github.com/' }
// { headers: …,
//   id: '6bfc21a0-0dad-48b2-8378-762e5f85f014',
//   method: 'GET',
//   type: 'request',
//   uri: 'https://github.com/' }
// { headers: …,
//   id: '6bfc21a0-0dad-48b2-8378-762e5f85f014',
//   statusCode: 200,
//   type: 'response',
//   uri: 'https://github.com/' }
```

You can optionally define a custom logging function which receives the request object (`data`) and the `request` instance:

```javascript
const logger = require('@uphold/request-logger');
const request = logger(require('request'), data => console.log(`${data.id} ${data.type}: ${data.uri}${data.statusCode ? ` (${data.statusCode})` : ''} ${(data.body ? `${data.body}` : '').length} bytes`));

request.get('https://www.github.com', () => {});

// 8a3600f9-0995-4a89-951f-caf7c0a79a69 request: https://www.github.com/ 0 bytes
// 8a3600f9-0995-4a89-951f-caf7c0a79a69 redirect: https://github.com/ (301) 0 bytes
// 8a3600f9-0995-4a89-951f-caf7c0a79a69 request: https://github.com/ 0 bytes
// 8a3600f9-0995-4a89-951f-caf7c0a79a69 response: https://github.com/ (200) 25562 bytes
```

Each `data` object contains a `type` property indicating the type of event:

- **error** - the request has failed due to an error (e.g. a timeout). `data.error` is defined.

- **request** - the request succeeded. `data.body` may be defined for POST requests.

- **response** - the request returned a response. Note that `request` only buffers the response body if a callback was given, so only in that case will `data.body` be defined.

- **redirect** - the request received a redirect status code (_HTTP 3xx_). `data.uri` will point to the URI of the next request.

- **complete** - the request has been completed. This event is only dispatched on POST requests.

In every event, a `data.id` parameter is defined to allow matching it to the request it originated from.

## Compatibility

The recommended node.js version is `>= 6` as it ships with native [ES2015 Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) support. This module supports node.js `4` by means of a polyfill that is loaded under the hood. As usual, keep in mind that polyfills are not as performant as their native counterpart.

The minimum required `request` version is `2.27.0`, although `2.54.0` is a particularly troubled version which is best avoided.

## Release

```shell
❯ npm version [<newversion> | major | minor | patch] -m "Release %s"`
```

## License

MIT

[npm-image]: https://img.shields.io/npm/v/@uphold/request-logger.svg?style=flat-square
[npm-url]: https://npmjs.org/package/@uphold/request-logger
[travis-image]: https://img.shields.io/travis/uphold/request-logger.svg?style=flat-square
[travis-url]: https://travis-ci.org/uphold/request-logger
