var StandardError = require("..")

function ChildError(msg, props) { StandardError.apply(this, arguments) }

ChildError.prototype = Object.create(StandardError.prototype, {
  constructor: {value: ChildError, configurable: true, writeable: true}
})

describe("StandardError", function() {
  describe("new", function() {
    it("must be an instance of StandardError", function() {
      new StandardError().must.be.an.instanceof(StandardError)
    })

    it("must set message", function() {
      new StandardError("Problem").must.have.own("message", "Problem")
    })

    it("must set properties", function() {
      var err = new StandardError({message: "Problem", code: 500})
      err.must.have.own("message", "Problem")
      err.must.have.own("code", 500)
    })

    it("must set message and properties", function() {
      var err = new StandardError("Problem", {code: 500})
      err.must.have.own("message", "Problem")
      err.must.have.own("code", 500)
    })

    it("must set message from object given both", function() {
      var err = new StandardError("Problem", {message: "OK"})
      err.must.have.own("message", "OK")
    })

    it("must set name", function() {
      new StandardError().must.have.own("name", "StandardError")
    })

    it("must set name given emtpy object", function() {
      new StandardError({}).must.have.own("name", "StandardError")
    })

    it("must set name from constructor", function() {
      new ChildError().must.have.own("name", "ChildError")
    })

    it("must set name from prototype", function() {
      function ChildError(msg, props) { StandardError.apply(this, arguments) }
      ChildError.prototype = Object.create(StandardError.prototype)
      ChildError.prototype.name = "FallacyError"
      new ChildError().must.have.own("name", "FallacyError")
    })

    it("must set name from object", function() {
      var err = new StandardError("Problem", {name: "FallacyError"})
      err.must.have.own("name", "FallacyError")
    })

    it("must set name from object when subclassed", function() {
      var err = new ChildError("Problem", {name: "FallacyError"})
      err.must.have.own("name", "FallacyError")
    })

    it("must set stack", function() {
      var err = new StandardError()
      err.must.have.own("stack")

      var stack = err.stack.split(/\n\s*/)
      stack[0].must.equal("StandardError")
      stack[1].must.include("index_test.js")
    })

    it("must set stack when subclassed", function() {
      var err = new ChildError()
      err.must.have.own("stack")

      var stack = err.stack.split(/\n\s*/)
      stack[0].must.equal("ChildError")
      stack[1].must.include("index_test.js")
      stack[2].must.not.include("index_test.js")
    })

    it("must set stack given name from object", function() {
      var err = new StandardError({name: "FallacyError"})
      err.must.have.own("stack")
      err.stack.split(/\n\s*/)[0].must.equal("FallacyError")
    })

    it("must set stack from object", function() {
      new ChildError({stack: "OMG"}).must.have.own("stack", "OMG")
    })

    it("must set stack from object even if empty", function() {
      new ChildError({stack: ""}).must.have.own("stack", "")
    })
  })

  describe(".prototype.toString", function() {
    it("must return message", function() {
      var err = new StandardError("Problem")
      err.toString().must.equal("StandardError: Problem")
    })

    it("must return set name", function() {
      var err = new StandardError("Problem")
      err.name = "OtherError"
      err.toString().must.equal("OtherError: Problem")
    })
  })

  describe("JSON.stringify", function() {
    it("must serialize enumerable properties", function() {
      var err = JSON.stringify(new StandardError("Problem", {code: 404}))
      var obj = {name: "StandardError", message: "Problem", code: 404}
      JSON.parse(err).must.eql(obj)
    })
  })
})
