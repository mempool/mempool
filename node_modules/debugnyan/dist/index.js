'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();
/**
 * Module dependencies.
 */

exports.default = debugnyan;

var _bunyan = require('bunyan');

var _bunyan2 = _interopRequireDefault(_bunyan);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Loggers.
 */

const loggers = Object.create(null);

/**
 * Default level.
 */

const level = _bunyan2.default.FATAL + 1;

/**
 * Export `debugnyan`.
 */

function debugnyan(name, options, config) {
  const components = name.split(':');

  var _components = _slicedToArray(components, 1);

  const root = _components[0];


  config = Object.assign({
    prefix: 'sub',
    suffix: 'component'
  }, config);

  if (!loggers[root]) {
    loggers[root] = _bunyan2.default.createLogger(Object.assign({}, options, { level: level, name: root }));
  }

  let child = loggers[root];

  for (let i = 1; i < components.length; i++) {
    const current = components[i];
    const next = loggers[components.slice(0, i).join(':')];
    const childName = components.slice(0, i + 1).join(':');

    if (loggers[childName]) {
      child = loggers[childName];

      continue;
    }

    options = Object.assign({}, options, {
      [`${ config.prefix.repeat(i - 1) }${ config.suffix }`]: current,
      level: level
    });

    child = next.child(options, true);

    loggers[childName] = child;
  }

  if (_debug2.default.enabled(name)) {
    child.level(_bunyan2.default.DEBUG);
  }

  return loggers[name];
}
module.exports = exports['default'];