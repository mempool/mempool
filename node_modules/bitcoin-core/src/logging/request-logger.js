
/**
 * Module dependencies.
 */

const { obfuscate } = require('./request-obfuscator');
const request = require('request');
const requestLogger = require('@uphold/request-logger');

/**
 * Exports.
 */

module.exports = logger => requestLogger(request, (request, instance) => {
  obfuscate(request, instance);

  if (request.type === 'response') {
    return logger.debug({ request }, `Received response for request ${request.id}`);
  }

  return logger.debug({ request }, `Making request ${request.id} to ${request.method} ${request.uri}`);
});
