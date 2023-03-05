import commands from './commands';
import http from 'http';
import https from 'https';
import { BitcoinRpcCredentials } from '../api/bitcoin/bitcoin-api-abstract-factory';
import { readFileSync } from 'fs';

class JsonRPC {
  private opts: BitcoinRpcCredentials;
  private cachedCookie?: string;

  constructor(opts: BitcoinRpcCredentials) {
    this.opts = opts;
  }

  call(method: string, params: any[]): Promise<any>;
  call(method: { method: string; params: any[] }[]): Promise<any>;
  call(
    method: string | { method: string; params: any[] }[],
    params?: any[]
  ): Promise<any>;
  call(
    method: string | { method: string; params: any[] }[],
    params?: any[]
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const time = Date.now();
      let requestJSON;

      if (Array.isArray(method)) {
        // multiple rpc batch call
        requestJSON = [];
        method.forEach((batchCall, i) => {
          requestJSON.push({
            id: time + '-' + i,
            method: batchCall.method,
            params: batchCall.params,
          });
        });
      } else {
        // single rpc call
        requestJSON = {
          id: time,
          method: method,
          params: params,
        };
      }

      // First we encode the request into JSON
      requestJSON = JSON.stringify(requestJSON);

      // prepare request options
      const requestOptions: http.RequestOptions | https.RequestOptions = {
        host: this.opts.host || 'localhost',
        port: this.opts.port || 8332,
        method: 'POST',
        path: '/',
        headers: {
          Host: this.opts.host || 'localhost',
          'Content-Length': requestJSON.length,
        },
        agent: false,
        rejectUnauthorized: this.opts.ssl && this.opts.sslStrict !== false,
      };

      if (this.opts.ssl && this.opts.sslCa) {
        requestOptions.ca = this.opts.sslCa;
      }

      // use HTTP auth if user and password set
      if (this.opts.cookie) {
        if (!this.cachedCookie) {
          this.cachedCookie = readFileSync(this.opts.cookie).toString();
        }
        requestOptions.auth = this.cachedCookie;
      } else if (this.opts.user && this.opts.pass) {
        requestOptions.auth = this.opts.user + ':' + this.opts.pass;
      }

      // Now we'll make a request to the server
      let cbCalled = false;
      const request = (this.opts.ssl ? https : http).request(requestOptions);

      // start request timeout timer
      const reqTimeout = setTimeout(() => {
        if (cbCalled) return;
        cbCalled = true;
        request.destroy();
        const err: NodeJS.ErrnoException = new Error('ETIMEDOUT');
        err.code = 'ETIMEDOUT';
        reject(err);
      }, this.opts.timeout || 30000);

      // set additional timeout on socket in case of remote freeze after sending headers
      request.setTimeout(this.opts.timeout || 30000, () => {
        if (cbCalled) return;
        cbCalled = true;
        request.destroy();
        const err: NodeJS.ErrnoException = new Error('ESOCKETTIMEDOUT');
        err.code = 'ESOCKETTIMEDOUT';
        reject(err);
      });

      request.on('error', (err) => {
        if (cbCalled) return;
        cbCalled = true;
        clearTimeout(reqTimeout);
        reject(err);
      });

      request.on('response', (response) => {
        clearTimeout(reqTimeout);

        // We need to buffer the response chunks in a nonblocking way.
        let buffer = '';
        response.on('data', (chunk) => {
          buffer = buffer + chunk;
        });
        // When all the responses are finished, we decode the JSON and
        // depending on whether it's got a result or an error, we call
        // emitSuccess or emitError on the promise.
        response.on('end', () => {
          let err;
          let decoded;

          if (cbCalled) return;
          cbCalled = true;

          try {
            decoded = JSON.parse(buffer);
          } catch (e) {
            // if we authenticated using a cookie and it failed, read the cookie file again
            if (
              response.statusCode === 401 /* Unauthorized */ &&
              this.opts.cookie
            ) {
              this.cachedCookie = undefined;
            }

            if (response.statusCode !== 200) {
              err = new Error(
                'Invalid params, response status code: ' + response.statusCode
              );
              err.code = -32602;
              reject(err);
            } else {
              err = new Error('Problem parsing JSON response from server');
              err.code = -32603;
              reject(err);
            }
            return;
          }

          if (!Array.isArray(decoded)) {
            decoded = [decoded];
          }

          // iterate over each response, normally there will be just one
          // unless a batch rpc call response is being processed
          decoded.forEach((decodedResponse) => {
            if ('error' in decodedResponse && decodedResponse.error !== null) {
              err = new Error(decodedResponse.error.message || '');
              if (decodedResponse.error.code) {
                err.code = decodedResponse.error.code;
              }
              reject(err);
            } else if ('result' in decodedResponse) {
              resolve(decodedResponse.result);
            } else {
              err = new Error(decodedResponse.error.message || '');
              if (decodedResponse.error.code) {
                err.code = decodedResponse.error.code;
              }
              reject(err);
            }
          });
        });
      });
      request.end(requestJSON);
    });
  }
}

// Add wrapper for separate rpc calls (see commands.ts)
for (const protoFn in commands) {
  JsonRPC.prototype[protoFn] = function (...args): Promise<any> {
    return this.call(commands[protoFn], args);
  };
}

// Include the just added wrappers to the type
export default JsonRPC as unknown as new (opts: BitcoinRpcCredentials) => {
  [rpc in keyof typeof commands]: (...args: any[]) => Promise<any>;
};
