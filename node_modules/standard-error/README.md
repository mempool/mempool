StandardError.js
================
[![NPM version][npm-badge]](http://badge.fury.io/js/standard-error)
[npm-badge]: https://badge.fury.io/js/standard-error.png

StandardError.js is a tiny JavaScript library that simplifies creating
subclasses of `Error` for **custom error classes** with the correct `name` and
`stack` property. Saves you from writing a few lines of boilerplate.

### Tour
- Create **custom error classes** and add new behavior to them while keeping the
  standard `Error` behavior in tact.
- Add **extra properties** to the error by just passing in an object.
- StandardError.js sets the error's **stack trace correctly**, even if your
  error class **subclasses/inherits** from StandardError.  
  Just inheriting from `Error` with `Object.create` breaks the stack trace.
- Every `StandardError` instance is also an instance of `Error`.
- Serializes all expected properties when passing it to `JSON.stringify`.  
  Did you know that the default `Error` object serializes to an empty object
  (`{}`)?
- Works both in Node.js and browsers and sets the stack trace via
  `Error.captureStackTrace` where available.


Installing
----------
```
npm install standard-error
```


Using
-----
Just require StandardError.js and either use it directly or inherit from it for
your custom error class.

### Throwing StandardError
Like `Error`, `StandardError` takes a message argument, but in addition to that,
you may give it an object with other properties to be set:

```javascript
var StandardError = require("standard-error")
throw new StandardError("Not Found", {code: 404})
```

The thrown instance of `StandardError` will then have both the `message` and the
`code` property.  
It'll also also have a `name` property set to `"StandardError"`.

You can skip the explicit `message` argument and give everything as an
object of properties:

```javascript
new StandardError({message: "Not Found", code: 404})
```

**Note**: All properties besides `stack` will be enumerable for easier
serialization with `JSON.stringify`. That includes the `name` property which
will be set from the constructor's name (defaults to `"StandardError"`).

### Subclassing and inheriting from StandardError
The real benefit of StandardError.js comes from subclassing it to create new
error classes and adding custom behavior to them.

Let's create an `HttpError` that we can instantiate with the HTTP status code
(`new HttpError(404)`) and have it set the message automatically based on that:

```javascript
var Http = require("http")
var StandardError = require("standard-error")

function HttpError(code, msg) {
  StandardError.call(this, msg || Http.STATUS_CODES[code], {code: code})
}

HttpError.prototype = Object.create(StandardError.prototype, {
  constructor: {value: HttpError, configurable: true, writable: true}
})
```

**Note** that you must set the `constructor` property like in the above
example. First, that's the proper way to subclass in JavaScript and second,
StandardError.js depends on that to know which functions to skip in the stack
trace.

#### Name

StandardError.js finds out the name (`err.name`) of your subclassed error from
its constructor function. However, if you minify your code, you can also set or
change it explicitly:

```javascript
ChildError.prototype.name = "FallacyError"
```

### Adding behavior to your subclass of StandardError

Now that you've inherited, you can, for example, customize stringifying by
overwriting `toString` on your subclass.  To get `new HttpError(404)` to print
itself as `404 Not Found`:

```javascript
HttpError.prototype.toString = function() {
  return this.code + " " + this.message
}
```

License
-------
StandardError.js is released under a *Lesser GNU Affero General Public License*, which
in summary means:

- You **can** use this program for **no cost**.
- You **can** use this program for **both personal and commercial reasons**.
- You **do not have to share your own program's code** which uses this program.
- You **have to share modifications** (e.g. bug-fixes) you've made to this
  program.

For more convoluted language, see the `LICENSE` file.


About
-----
**[Andri Möll](http://themoll.com)** typed this and the code.  
[Monday Calendar](https://mondayapp.com) supported the engineering work.

If you find StandardError.js needs improving, please don't hesitate to type to
me now at [andri@dot.ee][email] or [create an issue online][issues].

[email]: mailto:andri@dot.ee
[issues]: https://github.com/moll/js-standard-error/issues
