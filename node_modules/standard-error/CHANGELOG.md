## 1.1.0 (Jun 15, 2014)
- Allows overwriting the `stack` property if given in the object:

  ```javascript
  new StandardError({stack: stackOverflow})
  ```

- Fixes stack's first line when name given in the object:

  ```javascript
  new StandardError({name: "UnknownError"})
  ```

- Allows overriding `name` explicitly through the subclass's prototype.  
  Previously StandardError got the name only from the constructor function's
  `name` property or from the passed-in object.

  ```javascript
  function ChildError(msg, props) { StandardError.apply(this, arguments) }

  ChildError.prototype = Object.create(StandardError.prototype, {
    constructor: {value: ChildError, configurable: true, writeable: true}
  })

  ChildError.prototype.name = "FallacyError"
  ```

- Sets `StandardError.prototype.name` explicitly for cases where the code is
  minified.  
  If you don't minify your code (like when using it on the server side) you
  don't need to set `name` explicitly on your subclasses and can depend on
  StandardError.js finding it out from the constructor function.

- Uses `Error.captureStackTrace` only if available, so it'll work in non-V8
  JavaScript engines.

## 1.0.0 (May 1, 2014)
- First standard release.  
  There are now [15 competing standards](https://xkcd.com/927/)!
