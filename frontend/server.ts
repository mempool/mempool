import 'zone.js/dist/zone-node';
import './generated-config';

import { ngExpressEngine } from '@nguniversal/express-engine';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as domino from 'domino';
import { createProxyMiddleware } from 'http-proxy-middleware';

import { join } from 'path';
import { AppServerModule } from './src/main.server';
import { APP_BASE_HREF } from '@angular/common';
import { existsSync } from 'fs';

const template = fs.readFileSync(path.join(__dirname, '../browser/en-US/', 'index.html')).toString();
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
export function app(): express.Express {
  const server = express();
  const distFolder = join(__dirname, '../browser/en-US');

  // Our Universal express-engine (found @ https://github.com/angular/universal/tree/master/modules/express-engine)
  server.engine('html', ngExpressEngine({
    bootstrap: AppServerModule,
  }));

  server.set('view engine', 'html');
  server.set('views', distFolder);

  // map each locale to its folder
  mapLocaleToFolder(server, '/ar', 'ar');
  mapLocaleToFolder(server, '/cs', 'cs');
  mapLocaleToFolder(server, '/de', 'de');
  mapLocaleToFolder(server, '/en', 'en-US');
  mapLocaleToFolder(server, '/es', 'es');
  mapLocaleToFolder(server, '/fa', 'fa');
  mapLocaleToFolder(server, '/fr', 'fr');
  mapLocaleToFolder(server, '/ja', 'ja');
  mapLocaleToFolder(server, '/ka', 'ka');
  mapLocaleToFolder(server, '/ko', 'ko');
  mapLocaleToFolder(server, '/nl', 'nl');
  mapLocaleToFolder(server, '/nb', 'nb');
  mapLocaleToFolder(server, '/pt', 'pt');
  mapLocaleToFolder(server, '/sl', 'sl');
  mapLocaleToFolder(server, '/sv', 'sv');
  mapLocaleToFolder(server, '/tr', 'tr');
  mapLocaleToFolder(server, '/uk', 'uk');
  mapLocaleToFolder(server, '/fi', 'fi');
  mapLocaleToFolder(server, '/vi', 'vi');
  mapLocaleToFolder(server, '/zh', 'zh');

  // map null locale to en-US
  mapLocaleToFolder(server, '', 'en-US');

  // proxy API to nginx
  server.get('/api/**', createProxyMiddleware({
    // @ts-ignore
    target: win.__env.NGINX_PROTOCOL + '://' + win.__env.NGINX_HOSTNAME + ':' + win.__env.NGINX_PORT,
    changeOrigin: true,
  }));

  return server;
}

function mapLocaleToFolder(server, urlPrefix, folderName) {
  // only handle URLs that actually exist
  server.get(urlPrefix, getLocalizedSSR(folderName));
  server.get(urlPrefix + '/', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/tx/*', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/block/*', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/mempool-block/*', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/address/*', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/blocks', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/graphs', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/liquid', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/liquid/tx/*', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/liquid/block/*', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/liquid/mempool-block/*', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/liquid/address/*', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/liquid/asset/*', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/liquid/blocks', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/liquid/graphs', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/liquid/assets', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/liquid/api', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/liquid/tv', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/liquid/status', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/liquid/about', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/testnet', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/testnet/tx/*', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/testnet/block/*', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/testnet/mempool-block/*', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/testnet/address/*', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/testnet/blocks', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/testnet/graphs', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/testnet/api', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/testnet/tv', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/testnet/status', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/testnet/about', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/bisq', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/bisq/tx/*', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/bisq/blocks', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/bisq/block/*', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/bisq/address/*', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/bisq/stats', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/bisq/about', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/bisq/api', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/about', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/api', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/tv', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/status', getLocalizedSSR(folderName));
  server.get(urlPrefix + '/terms-of-service', getLocalizedSSR(folderName));

  // fallback to static file handler so we send HTTP 404 to nginx
  const distFolder = join(__dirname, '../browser' + (urlPrefix === '' ? '/en-US' : ''));
  server.get(urlPrefix + '/**', express.static(distFolder, { maxAge: '1y' }));
}

function getLocalizedSSR(locale) {
  return (req, res) => {
    const distFolder = join(__dirname, `../browser/${locale}`);
    res.render(join(distFolder, 'index.html'), {
      req,
      providers: [
        { provide: APP_BASE_HREF, useValue: req.baseUrl }
      ]
    });
  }
}

function run(): void {
  const port = process.env.PORT || 4000;

  // Start up the Node server
  const server = app();
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
