var has = Object.hasOwnProperty
var proto = Object.getPrototypeOf
var trace = Error.captureStackTrace
module.exports = StandardError

function StandardError(msg, props) {
  // Let all properties be enumerable for easier serialization.
  if (msg && typeof msg == "object") props = msg, msg = undefined
  else this.message = msg

  // Name has to be an own property (or on the prototype a single step up) for
  // the stack to be printed with the correct name.
  if (props) for (var key in props) this[key] = props[key]
  if (!has.call(this, "name"))
    this.name = has.call(proto(this), "name")? this.name : this.constructor.name

  if (trace && !("stack" in this)) trace(this, this.constructor)
}

StandardError.prototype = Object.create(Error.prototype, {
  constructor: {value: StandardError, configurable: true, writable: true}
})

// Set name explicitly for when the code gets minified.
StandardError.prototype.name = "StandardError"
