
/**
 * Module dependencies.
 */

const _ = require('lodash');
const methods = require('../methods');

/**
 * Map all methods to lowercase.
 */

const lowercaseMethods = _.mapKeys(methods, (value, key) => key.toLowerCase());

/**
 * Helper.
 */

const isJSON = data => {
  try {
    JSON.parse(data);

    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Obfuscate the response body.
 */

function obfuscateResponseBody(body, method) {
  const fn = _.get(lowercaseMethods[method], 'obfuscate.response');

  if (!fn || _.isEmpty(body.result)) {
    return body;
  }

  return _.defaults({ result: fn(body.result) }, body);
}

/**
 * Obfuscate the response.
 */

function obfuscateResponse(request, instance) {
  if (request.type !== 'response') {
    return;
  }

  if (!request.body) {
    return;
  }

  if (_.get(request, `headers['content-type']`) === 'application/octet-stream') {
    request.body = '******';

    return;
  }

  if (!instance.body) {
    return;
  }

  if (!isJSON(request.body)) {
    return;
  }

  request.body = JSON.parse(request.body);

  const requestBody = JSON.parse(instance.body);

  if (Array.isArray(request.body)) {
    const methodsById = _.mapKeys(requestBody, method => method.id);

    request.body = _.map(request.body, request => obfuscateResponseBody(request, methodsById[request.id].method));
  } else {
    request.body = obfuscateResponseBody(request.body, requestBody.method);
  }

  request.body = JSON.stringify(request.body);
}

/**
 * Obfuscate the request body.
 */

function obfuscateRequestBody(body) {
  const method = _.get(lowercaseMethods[body.method], 'obfuscate.request');

  if (!method) {
    return body;
  }

  if (_.isPlainObject(body.params)) {
    return _.assign(body, { params: method.named(body.params) });
  }

  return _.assign(body, { params: method.default(body.params) });
}

/**
 * Obfuscate the request.
 */

function obfuscateRequest(request) {
  if (request.type !== 'request') {
    return;
  }

  if (!_.isString(request.body)) {
    return;
  }

  request.body = JSON.parse(request.body);

  if (Array.isArray(request.body)) {
    request.body = _.map(request.body, obfuscateRequestBody);
  } else {
    request.body = obfuscateRequestBody(request.body);
  }

  request.body = JSON.stringify(request.body);
}

/**
 * Obfuscate headers.
 */

function obfuscateHeaders(request) {
  if (request.type !== 'request') {
    return;
  }

  if (!_.has(request, 'headers.authorization')) {
    return;
  }

  request.headers.authorization = request.headers.authorization.replace(/(Basic )(.*)/, `$1******`);
}

/**
 * Export `RequestObfuscator`.
 */

module.exports = {
  obfuscate: (request, instance) => {
    obfuscateHeaders(request);
    obfuscateRequest(request);
    obfuscateResponse(request, instance);
  }
};
