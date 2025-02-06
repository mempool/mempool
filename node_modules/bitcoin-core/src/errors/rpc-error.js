
/**
 * Module dependencies.
 */

const { STATUS_CODES } = require('http');
const StandardError = require('./standard-error');

/**
 * Export `RpcError` class.
 */

module.exports = class RpcError extends StandardError {
  constructor(code, msg, props = {}) {
    if (typeof code != 'number') {
      throw new TypeError(`Non-numeric HTTP code`);
    }

    if (typeof msg == 'object' && msg !== null) {
      props = msg;
      msg = null;
    }

    props.code = code;

    super(msg || STATUS_CODES[code], props);
  }

  get status() {
    return this.code;
  }

  set status(value) {
    Object.defineProperty(this, 'status', {
      configurable: true,
      enumerable: true,
      value,
      writable: true
    });
  }

  toString() {
    return `${this.name}: ${this.code} ${this.message}`;
  }
};
