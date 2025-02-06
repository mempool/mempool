'use strict';

/**
 * Module dependencies.
 */

const Proxy = require('./proxy');
const uuid = require('uuid/v4');

/**
 * Exports
 */

module.exports = function logger(request, log) {
  if (log === undefined) {
    log = data => console.error(data);
  }

  if (typeof log !== 'function') {
    throw new Error('Expected a function');
  }

  function apply(target, caller, args) {
    const id = uuid();
    const startTime = Date.now();

    return target.apply(undefined, args)
      .on('complete', function(response) {
        if (!this.callback) {
          return;
        }

        log({
          body: response.body,
          duration: Date.now() - startTime,
          headers: response.headers,
          id,
          statusCode: response.statusCode,
          type: 'response',
          uri: this.uri.href
        }, this);
      }).on('error', function(error) {
        log({
          duration: Date.now() - startTime,
          error,
          headers: this.headers,
          id,
          method: this.method.toUpperCase(),
          type: 'error',
          uri: this.uri.href
        }, this);
      }).on('redirect', function() {
        log({
          duration: Date.now() - startTime,
          headers: this.response.headers,
          id,
          statusCode: this.response.statusCode,
          type: 'redirect',
          uri: this.uri.href
        }, this);
      }).on('request', function() {
        const data = {
          headers: this.headers,
          id,
          method: this.method,
          type: 'request',
          uri: this.uri.href
        };

        if (this.body) {
          data.body = this.body.toString('utf8');
        }

        log(data, this);
      }).on('response', function(response) {
        if (this.callback) {
          return;
        }

        log({
          duration: Date.now() - startTime,
          headers: response.headers,
          id,
          statusCode: response.statusCode,
          type: 'response',
          uri: this.uri.href
        }, this);
      });
  }

  return new Proxy(request, {
    apply,
    get(target, name) {
      if (['del', 'delete', 'get', 'head', 'patch', 'post', 'put'].indexOf(name) !== -1) {
        return new Proxy(target[name], { apply });
      }

      return target[name];
    }
  });
};
