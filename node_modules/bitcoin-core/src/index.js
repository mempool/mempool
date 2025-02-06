
/**
 * Module dependencies.
 */

const _ = require('lodash');
const Parser = require('./parser');
const Requester = require('./requester');
const debugnyan = require('debugnyan');
const methods = require('./methods');
const requestLogger = require('./logging/request-logger');
const semver = require('semver');

/**
 * Promisify helper.
 */

const promisify = fn => (...args) => new Promise((resolve, reject) => {
  fn(...args, (error, value) => {
    if (error) {
      reject(error);

      return;
    }

    resolve(value);
  });
});

/**
 * Constructor.
 */

class Client {
  constructor({
    headers = {},
    host = 'http://localhost:8332',
    logger = debugnyan('bitcoin-core'),
    password,
    timeout = 30000,
    username,
    version,
    wallet
  } = {}) {
    this.auth = (password || username) && { pass: password, user: username };
    this.hasNamedParametersSupport = false;
    this.headers = headers;
    this.host = host;
    this.password = password;
    this.timeout = timeout;
    this.wallet = wallet;

    // Version handling.
    if (version) {
      // Capture X.Y.Z when X.Y.Z.A is passed to support oddly formatted Bitcoin Core
      // versions such as 0.15.0.1.
      const result = /[0-9]+\.[0-9]+\.[0-9]+/.exec(version);

      if (!result) {
        throw new Error(`Invalid Version "${version}"`, { version });
      }

      [version] = result;

      this.hasNamedParametersSupport = semver.satisfies(version, '>=0.14.0');
    }

    this.version = version;
    this.methods = _.transform(methods, (result, method, name) => {
      result[_.toLower(name)] = {
        features: _.transform(method.features, (result, constraint, name) => {
          result[name] = {
            supported: version ? semver.satisfies(version, constraint) : true
          };
        }, {}),
        supported: version ? semver.satisfies(version, method.version) : true
      };
    }, {});

    const request = requestLogger(logger);

    this.request = request.defaults({
      baseUrl: this.host,
      headers: this.headers,
      timeout: this.timeout
    });
    this.request.getAsync = promisify(this.request.get);
    this.request.postAsync = promisify(this.request.post);
    this.requester = new Requester({ methods: this.methods, version });
    this.parser = new Parser();
  }

  /**
   * Execute `rpc` command.
   */

  async command(...args) {
    let body;
    let multiwallet;
    let [input, ...parameters] = args; // eslint-disable-line prefer-const
    const isBatch = Array.isArray(input);

    if (isBatch) {
      multiwallet = _.some(input, command => {
        return _.get(this.methods[command.method], 'features.multiwallet.supported', false) === true;
      });

      body = input.map((method, index) => this.requester.prepare({
        method: method.method,
        parameters: method.parameters,
        suffix: index
      }));
    } else {
      if (this.hasNamedParametersSupport && parameters.length === 1 && _.isPlainObject(parameters[0])) {
        parameters = parameters[0];
      }

      multiwallet = _.get(this.methods[input], 'features.multiwallet.supported', false) === true;
      body = this.requester.prepare({ method: input, parameters });
    }

    let uri = '/';

    if (multiwallet && this.wallet) {
      uri = `/wallet/${this.wallet}`;
    } else if (multiwallet && !this.wallet && this.allowDefaultWallet) {
      uri = '/wallet/';
    }

    if (this.auth) {
      return this.parser.rpc(await this.request.postAsync({
        auth: _.pickBy(this.auth, _.identity),
        body: JSON.stringify(body),
        followRedirect: true,
        uri
      }));
    }

    return this.parser.rpc(await this.request.postAsync({
      body: JSON.stringify(body),
      followRedirect: true,
      uri
    }));
  }

  /**
   * Given a transaction hash, returns a transaction in binary, hex-encoded binary, or JSON formats.
   */

  async getTransactionByHash(hash, { extension = 'json' } = {}) {
    return this.parser.rest(extension, await this.request.getAsync({
      encoding: extension === 'bin' ? null : undefined,
      url: `/rest/tx/${hash}.${extension}`
    }));
  }

  /**
   * Given a block hash, returns a block, in binary, hex-encoded binary or JSON formats.
   * With `summary` set to `false`, the JSON response will only contain the transaction
   * hash instead of the complete transaction details. The option only affects the JSON response.
   */

  async getBlockByHash(hash, { summary = false, extension = 'json' } = {}) {
    const encoding = extension === 'bin' ? null : undefined;
    const url = `/rest/block${summary ? '/notxdetails/' : '/'}${hash}.${extension}`;

    return this.parser.rest(extension, await this.request.getAsync({ encoding, url }));
  }

  /**
   * Given a block hash, returns amount of blockheaders in upward direction.
   */

  async getBlockHeadersByHash(hash, count, { extension = 'json' } = {}) {
    const encoding = extension === 'bin' ? null : undefined;
    const url = `/rest/headers/${count}/${hash}.${extension}`;

    return this.parser.rest(extension, await this.request.getAsync({ encoding, url }));
  }

  /**
   * Returns various state info regarding block chain processing.
   * Only supports JSON as output format.
   */

  async getBlockchainInformation() {
    return this.parser.rest('json', await this.request.getAsync(`/rest/chaininfo.json`));
  }

  /**
   * Query unspent transaction outputs for a given set of outpoints.
   * See BIP64 for input and output serialisation:
   * 	 - https://github.com/bitcoin/bips/blob/master/bip-0064.mediawiki
   */

  async getUnspentTransactionOutputs(outpoints, { extension = 'json' } = {}) {
    const encoding = extension === 'bin' ? null : undefined;
    const sets = _.flatten([outpoints]).map(outpoint => {
      return `${outpoint.id}-${outpoint.index}`;
    }).join('/');
    const url = `/rest/getutxos/checkmempool/${sets}.${extension}`;

    return this.parser.rest(extension, await this.request.getAsync({ encoding, url }));
  }

  /**
   * Returns transactions in the transaction memory pool.
   * Only supports JSON as output format.
   */

  async getMemoryPoolContent() {
    return this.parser.rest('json', await this.request.getAsync('/rest/mempool/contents.json'));
  }

  /**
   * Returns various information about the transaction memory pool.
   * Only supports JSON as output format.
   *
   *   - size: the number of transactions in the transaction memory pool.
   *   - bytes: size of the transaction memory pool in bytes.
   *   - usage: total transaction memory pool memory usage.
   */

  async getMemoryPoolInformation() {
    return this.parser.rest('json', await this.request.getAsync('/rest/mempool/info.json'));
  }
}

/**
 * Add all known RPC methods.
 */

_.forOwn(methods, (options, method) => {
  Client.prototype[method] = _.partial(Client.prototype.command, method.toLowerCase());
});

/**
 * Export Client class.
 */

module.exports = Client;
