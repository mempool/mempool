import 'zone.js/node';
import './generated-config';

import { ngExpressEngine } from '@nguniversal/express-engine';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as domino from 'domino';

import { join } from 'path';
import { AppServerModule } from './src/main.server';
import { APP_BASE_HREF } from '@angular/common';
import { existsSync } from 'fs';

const template = fs.readFileSync(path.join(process.cwd(), 'dist/mempool/browser/en-US/', 'index.html')).toString();
const win = domino.createWindow(template);

// @ts-ignore
win.__env = global.__env;

// @ts-ignore
win.matchMedia = () => {
  return {
    matches: true
  };
};

// @ts-ignore
win.setTimeout = (fn) => { fn(); };
win.document.body.scrollTo = (() => {});
// @ts-ignore
global['window'] = win;
global['document'] = win.document;
// @ts-ignore
global['history'] = { state: { } };

global['localStorage'] = {
  getItem: () => '',
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => '',
};

// The Express app is exported so that it can be used by serverless Functions.
export function app(locale: string): express.Express {
  const server = express();
  const distFolder = join(process.cwd(), `dist/mempool/browser/${locale}`);
  const indexHtml = existsSync(join(distFolder, 'index.original.html')) ? 'index.original.html' : 'index';

  // Our Universal express-engine (found @ https://github.com/angular/universal/tree/master/modules/express-engine)
  server.engine('html', ngExpressEngine({
    bootstrap: AppServerModule,
  }));

  server.set('view engine', 'html');
  server.set('views', distFolder);

  // only handle URLs that actually exist
  //server.get(locale, getLocalizedSSR(indexHtml));
  server.get('/', getLocalizedSSR(indexHtml));
  server.get('/tx/*', getLocalizedSSR(indexHtml));
  server.get('/block/*', getLocalizedSSR(indexHtml));
  server.get('/mempool-block/*', getLocalizedSSR(indexHtml));
  server.get('/address/*', getLocalizedSSR(indexHtml));
  server.get('/blocks', getLocalizedSSR(indexHtml));
  server.get('/pools', getLocalizedSSR(indexHtml));
  server.get('/graphs', getLocalizedSSR(indexHtml));
  server.get('/liquid', getLocalizedSSR(indexHtml));
  server.get('/liquid/tx/*', getLocalizedSSR(indexHtml));
  server.get('/liquid/block/*', getLocalizedSSR(indexHtml));
  server.get('/liquid/mempool-block/*', getLocalizedSSR(indexHtml));
  server.get('/liquid/address/*', getLocalizedSSR(indexHtml));
  server.get('/liquid/asset/*', getLocalizedSSR(indexHtml));
  server.get('/liquid/blocks', getLocalizedSSR(indexHtml));
  server.get('/liquid/graphs', getLocalizedSSR(indexHtml));
  server.get('/liquid/assets', getLocalizedSSR(indexHtml));
  server.get('/liquid/api', getLocalizedSSR(indexHtml));
  server.get('/liquid/tv', getLocalizedSSR(indexHtml));
  server.get('/liquid/status', getLocalizedSSR(indexHtml));
  server.get('/liquid/about', getLocalizedSSR(indexHtml));
  server.get('/testnet', getLocalizedSSR(indexHtml));
  server.get('/testnet/tx/*', getLocalizedSSR(indexHtml));
  server.get('/testnet/block/*', getLocalizedSSR(indexHtml));
  server.get('/testnet/mempool-block/*', getLocalizedSSR(indexHtml));
  server.get('/testnet/address/*', getLocalizedSSR(indexHtml));
  server.get('/testnet/blocks', getLocalizedSSR(indexHtml));
  server.get('/testnet/pools', getLocalizedSSR(indexHtml));
  server.get('/testnet/graphs', getLocalizedSSR(indexHtml));
  server.get('/testnet/api', getLocalizedSSR(indexHtml));
  server.get('/testnet/tv', getLocalizedSSR(indexHtml));
  server.get('/testnet/status', getLocalizedSSR(indexHtml));
  server.get('/testnet/about', getLocalizedSSR(indexHtml));
  server.get('/signet', getLocalizedSSR(indexHtml));
  server.get('/signet/tx/*', getLocalizedSSR(indexHtml));
  server.get('/signet/block/*', getLocalizedSSR(indexHtml));
  server.get('/signet/mempool-block/*', getLocalizedSSR(indexHtml));
  server.get('/signet/address/*', getLocalizedSSR(indexHtml));
  server.get('/signet/blocks', getLocalizedSSR(indexHtml));
  server.get('/signet/pools', getLocalizedSSR(indexHtml));
  server.get('/signet/graphs', getLocalizedSSR(indexHtml));
  server.get('/signet/api', getLocalizedSSR(indexHtml));
  server.get('/signet/tv', getLocalizedSSR(indexHtml));
  server.get('/signet/status', getLocalizedSSR(indexHtml));
  server.get('/signet/about', getLocalizedSSR(indexHtml));
  server.get('/bisq', getLocalizedSSR(indexHtml));
  server.get('/bisq/tx/*', getLocalizedSSR(indexHtml));
  server.get('/bisq/blocks', getLocalizedSSR(indexHtml));
  server.get('/bisq/block/*', getLocalizedSSR(indexHtml));
  server.get('/bisq/address/*', getLocalizedSSR(indexHtml));
  server.get('/bisq/stats', getLocalizedSSR(indexHtml));
  server.get('/bisq/about', getLocalizedSSR(indexHtml));
  server.get('/bisq/api', getLocalizedSSR(indexHtml));
  server.get('/about', getLocalizedSSR(indexHtml));
  server.get('/api', getLocalizedSSR(indexHtml));
  server.get('/tv', getLocalizedSSR(indexHtml));
  server.get('/status', getLocalizedSSR(indexHtml));
  server.get('/terms-of-service', getLocalizedSSR(indexHtml));

  // fallback to static file handler so we send HTTP 404 to nginx
  server.get('/**', express.static(distFolder, { maxAge: '1y' }));

  return server;
}

function getLocalizedSSR(indexHtml) {
  return (req, res) => {
    res.render(indexHtml, {
      req,
      providers: [
        { provide: APP_BASE_HREF, useValue: req.baseUrl }
      ]
    });
  }
}

// only used for development mode
function run(): void {
  const port = process.env.PORT || 4000;

  // Start up the Node server
  const server = app('en-US');
  server.listen(port, () => {
    console.log(`Node Express server listening on port ${port}`);
  });
}

// Webpack will replace 'require' with '__webpack_require__'
// '__non_webpack_require__' is a proxy to Node 'require'
// The below code is to ensure that the server is run only when not requiring the bundle.
declare const __non_webpack_require__: NodeRequire;
const mainModule = __non_webpack_require__.main;
const moduleFilename = mainModule && mainModule.filename || '';
if (moduleFilename === __filename || moduleFilename.includes('iisnode')) {
  run();
}

export * from './src/main.server';
