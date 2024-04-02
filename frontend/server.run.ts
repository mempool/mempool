import './src/resources/config.js';

import * as domino from 'domino';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';

const {readFileSync, existsSync} = require('fs');
const {createProxyMiddleware} = require('http-proxy-middleware');

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

/**
 * Return the list of supported and actually active locales
 */
function getActiveLocales() {
  const angularConfig = JSON.parse(readFileSync('angular.json', 'utf8'));

  const supportedLocales = [
    angularConfig.projects.mempool.i18n.sourceLocale,
    ...Object.keys(angularConfig.projects.mempool.i18n.locales),
  ];

  return supportedLocales.filter(locale => locale === 'en-US' && existsSync(`./dist/mempool/server/${locale}`));
  // return supportedLocales.filter(locale => existsSync(`./dist/mempool/server/${locale}`));
}

function app() {
  const server = express();

  // proxy websocket
  server.get('/api/v1/ws', createProxyMiddleware({
    target: 'ws://localhost:4200/api/v1/ws',
    changeOrigin: true,
    ws: true,
    logLevel: 'debug'
  }));
  // proxy API to nginx
  server.get('/api/**', createProxyMiddleware({
    // @ts-ignore
    target: win.__env.NGINX_PROTOCOL + '://' + win.__env.NGINX_HOSTNAME + ':' + win.__env.NGINX_PORT,
    changeOrigin: true,
  }));
  server.get('/resources/**', express.static('./src'));


  // map / and /en to en-US
  const defaultLocale = 'en-US';
  console.log(`serving default locale: ${defaultLocale}`);
  const appServerModule = require(`./dist/mempool/server/${defaultLocale}/main.js`);
  server.use('/', appServerModule.app(defaultLocale));
  server.use('/en', appServerModule.app(defaultLocale));

  // map each locale to its localized main.js
  getActiveLocales().forEach(locale => {
    console.log('serving locale:', locale);
    const appServerModule = require(`./dist/mempool/server/${locale}/main.js`);

    // map everything to itself
    server.use(`/${locale}`, appServerModule.app(locale));

  });

  return server;
}

function run() {
  const port = process.env.PORT || 4000;

  // Start up the Node server
  app().listen(port, () => {
    console.log(`Node Express server listening on port ${port}`);
  });
}

run();