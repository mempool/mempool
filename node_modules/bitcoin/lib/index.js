var commands = require('./commands')
var rpc = require('./jsonrpc')

// ===----------------------------------------------------------------------===//
// Client
// ===----------------------------------------------------------------------===//
function Client (opts) {
  this.rpc = new rpc.Client(opts)
  this.wallet = opts.wallet
}

// ===----------------------------------------------------------------------===//
// cmd
// ===----------------------------------------------------------------------===//
Client.prototype.cmd = function () {
  var args = [].slice.call(arguments)
  var cmd = args.shift()

  callRpc(cmd, args, this.rpc, this.wallet)
}

// ===----------------------------------------------------------------------===//
// callRpc
// ===----------------------------------------------------------------------===//
function callRpc (cmd, args, rpc, wallet) {
  var fn = args[args.length - 1]

  // If the last argument is a callback, pop it from the args list
  if (typeof fn === 'function') {
    args.pop()
  } else {
    fn = function () {}
  }

  rpc.call(cmd, args, function () {
    var args = [].slice.call(arguments)
    args.unshift(null)
    fn.apply(this, args)
  }, function (err) {
    fn(err)
  }, wallet ? `/wallet/${wallet}` : undefined)
}

// ===----------------------------------------------------------------------===//
// Initialize wrappers
// ===----------------------------------------------------------------------===//
(function () {
  for (var protoFn in commands) {
    (function (protoFn) {
      Client.prototype[protoFn] = function () {
        var args = [].slice.call(arguments)
        callRpc(commands[protoFn], args, this.rpc, this.wallet)
      }
    })(protoFn)
  }
})()

// Export!
module.exports.Client = Client
