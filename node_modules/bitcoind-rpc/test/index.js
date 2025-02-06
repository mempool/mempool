'use strict';

var chai = require('chai');
var RpcClient = require('../');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var sinon = require('sinon');
var should = chai.should();
var http = require('http');
var https = require('https');
var async = require('async');

describe('RpcClient', function() {

  it('should initialize the main object', function() {
    should.exist(RpcClient);
  });

  it('should be able to create instance', function() {
    var s = new RpcClient();
    should.exist(s);
  });

  it('default to rejectUnauthorized as true', function() {
    var s = new RpcClient();
    should.exist(s);
    s.rejectUnauthorized.should.equal(true);
  });

  it('should be able to define a custom logger', function() {
    var customLogger = {
      info: function(){},
      warn: function(){},
      err: function(){},
      debug: function(){}
    };
    RpcClient.config.log = customLogger;
    var s = new RpcClient();
    s.log.should.equal(customLogger);
    RpcClient.config.log = false;
  });

  it('should be able to define the logger to normal', function() {
    RpcClient.config.logger = 'normal';
    var s = new RpcClient();
    s.log.should.equal(RpcClient.loggers.normal);
  });

  it('should be able to define the logger to none', function() {
    RpcClient.config.logger = 'none';
    var s = new RpcClient();
    s.log.should.equal(RpcClient.loggers.none);
  });

  function FakeResponse(){
    EventEmitter.call(this);
  }
  util.inherits(FakeResponse, EventEmitter);

  function FakeRequest(){
    EventEmitter.call(this);
    return this;
  }
  util.inherits(FakeRequest, EventEmitter);
  FakeRequest.prototype.setHeader = function() {};
  FakeRequest.prototype.write = function(data) {
    this.data = data;
  };
  FakeRequest.prototype.end = function() {};

  it('should use https', function() {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      port: 8332,
    });
    client.protocol.should.equal(https);

  });

  it('should use http', function() {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      protocol: 'http'
    });
    client.protocol.should.equal(http);

  });

  it('should call a method and receive response', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    var requestStub = sinon.stub(client.protocol, 'request', function(options, callback){
      var res = new FakeResponse();
      var req =  new FakeRequest();
      setTimeout(function(){
        res.emit('data', '{}');
        res.emit('end');
      }, 10);
      callback(res);
      return req;
    });

    client.setTxFee(0.01, function(error, parsedBuf) {
      requestStub.restore();
      should.not.exist(error);
      should.exist(parsedBuf);
      done();
    });

  });

  it('accept many values for bool', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: false
    });

    var requestStub = sinon.stub(client.protocol, 'request', function(options, callback){
      var res = new FakeResponse();
      var req = new FakeRequest();
      setTimeout(function(){
        res.emit('data', req.data);
        res.emit('end');
      }, 10);
      callback(res);
      return req;
    });

    async.eachSeries([true, 'true', 1, '1', 'True'], function(i, next) {
      client.importAddress('n28S35tqEMbt6vNad7A5K3mZ7vdn8dZ86X', '', i, function(error, parsedBuf) {
        should.not.exist(error);
        should.exist(parsedBuf);
        parsedBuf.params[2].should.equal(true);
        next();
      });
    }, function(err) {
      requestStub.restore();
      done();
    });

  });

  it('should batch calls for a method and receive a response', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: false
    });

    var requestStub = sinon.stub(client.protocol, 'request', function(options, callback){
      var res = new FakeResponse();
      setTimeout(function(){
        res.emit('data', '[{}, {}, {}]');
        res.emit('end');
      }, 10);
      callback(res);
      return new FakeRequest();
    });

    client.batchedCalls = [];
    client.listReceivedByAccount(1, true);
    client.listReceivedByAccount(2, true);
    client.listReceivedByAccount(3, true);
    client.batchedCalls.length.should.equal(3);
    client.batch(function(){
      // batch started
    }, function(error, result){
      // batch ended
      requestStub.restore();
      should.not.exist(error);
      should.exist(result);
      result.length.should.equal(3);
      done();
    });

  });

  it('should handle connection rejected 401 unauthorized', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    var requestStub = sinon.stub(client.protocol, 'request', function(options, callback){
      var res = new FakeResponse();
      res.statusCode = 401;
      setTimeout(function(){
        res.emit('end');
      }, 10);
      callback(res);
      return new FakeRequest();
    });

    client.getBalance('n28S35tqEMbt6vNad7A5K3mZ7vdn8dZ86X', 6, function(error, parsedBuf) {
      requestStub.restore();
      should.exist(error);
      error.message.should.equal('Bitcoin Core JSON-RPC: host=localhost port=8332: Connection Rejected: 401 Unnauthorized');
      done();
    });

  });

  it('should handle connection rejected 401 forbidden', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    var requestStub = sinon.stub(client.protocol, 'request', function(options, callback){
      var res = new FakeResponse();
      res.statusCode = 403;
      setTimeout(function(){
        res.emit('end');
      }, 10);
      callback(res);
      return new FakeRequest();
    });

    client.getDifficulty(function(error, parsedBuf) {
      requestStub.restore();
      should.exist(error);
      error.message.should.equal('Bitcoin Core JSON-RPC: host=localhost port=8332: Connection Rejected: 403 Forbidden');
      done();
    });

  });

  it('should handle EPIPE error case 1', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    var requestStub = sinon.stub(client.protocol, 'request', function(options, callback){
      var res = new FakeResponse();
      setTimeout(function(){
        res.emit('data', '{}');
        res.emit('end');
      }, 10);
      var req = new FakeRequest();
      setTimeout(function(){
        req.emit('error', new Error('write EPIPE'));
      }, 8);
      callback(res);
      return req;
    });

    client.getDifficulty(function(error, parsedBuf) {
      requestStub.restore();
      should.exist(error);
      error.message.should.equal('Bitcoin Core JSON-RPC: host=localhost port=8332: Request Error: write EPIPE');
      done();
    });

  });

  it('should handle EPIPE error case 2', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    var requestStub = sinon.stub(client.protocol, 'request', function(options, callback){
      var res = new FakeResponse();
      setTimeout(function(){
        res.emit('data', '{}');
        res.emit('end');
      }, 8);
      var req = new FakeRequest();
      setTimeout(function(){
        req.emit('error', new Error('write EPIPE'));
      }, 10);
      callback(res);
      req.on('error', function(err) {
        requestStub.restore();
        done();
      });
      return req;
    });

    client.getDifficulty(function(error, parsedBuf) {});

  });

  it('should handle ECONNREFUSED error', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    var requestStub = sinon.stub(client.protocol, 'request', function(options, callback){
      var res = new FakeResponse();
      var req = new FakeRequest();
      setTimeout(function(){
        req.emit('error', new Error('connect ECONNREFUSED'));
      }, 10);
      callback(res);
      return req;
    });

    client.getDifficulty(function(error, parsedBuf) {
      requestStub.restore();
      should.exist(error);
      error.message.should.equal('Bitcoin Core JSON-RPC: host=localhost port=8332: Request Error: connect ECONNREFUSED');
      done();
    });

  });

  it('should callback with error if invalid json', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    var requestStub = sinon.stub(client.protocol, 'request', function(options, callback){
      var res = new FakeResponse();
      setTimeout(function(){
        res.emit('data', 'not a json string');
        res.emit('end');
      }, 8);
      var req = new FakeRequest();
      callback(res);
      return req;
    });

    client.getDifficulty(function(error, parsedBuf) {
      requestStub.restore();
      should.exist(error);
      error.message.should.equal('Bitcoin Core JSON-RPC: host=localhost port=8332: Error Parsing JSON: Unexpected token o');
      done();
    });

  });

  it('should callback with error if blank response', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    var requestStub = sinon.stub(client.protocol, 'request', function(options, callback){
      var res = new FakeResponse();
      setTimeout(function(){
        res.emit('data', '');
        res.emit('end');
      }, 8);
      var req = new FakeRequest();
      callback(res);
      return req;
    });

    client.getDifficulty(function(error, parsedBuf) {
      requestStub.restore();
      should.exist(error);
      error.message.should.equal('Bitcoin Core JSON-RPC: host=localhost port=8332: Error Parsing JSON: Unexpected end of input');
      done();
    });

  });

  it('should add additional http options', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    client.httpOptions = {
      port: 20001
    };

    var calledPort = false;

    var requestStub = sinon.stub(client.protocol, 'request', function(options, callback){
      calledPort = options.port;
      var res = new FakeResponse();
      setTimeout(function(){
        res.emit('data', '{}');
        res.emit('end');
      }, 8);
      var req = new FakeRequest();
      callback(res);
      return req;
    });

    client.getDifficulty(function(error, parsedBuf) {
      should.not.exist(error);
      should.exist(parsedBuf);
      calledPort.should.equal(20001);
      requestStub.restore();
      done();
    });

  });

});
