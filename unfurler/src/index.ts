import express from "express";
import { Application, Request, Response, NextFunction } from 'express';
import * as http from 'http';
import * as https from 'https';
import config from './config';
import { Cluster } from 'puppeteer-cluster';
import ReusablePage from './concurrency/ReusablePage';
import ReusableSSRPage from './concurrency/ReusableSSRPage';
import { parseLanguageUrl } from './language/lang';
import { matchRoute, networks } from './routes';
import nodejsPath from 'path';
import logger from './logger';
import { TimeoutError } from "puppeteer";
const puppeteerConfig = require('../puppeteer.config.json');

if (config.PUPPETEER.EXEC_PATH) {
  puppeteerConfig.executablePath = config.PUPPETEER.EXEC_PATH;
}

const puppeteerEnabled = config.PUPPETEER.ENABLED && (config.PUPPETEER.CLUSTER_SIZE > 0);

class Server {
  private server: http.Server | undefined;
  private app: Application;
  cluster?: Cluster;
  ssrCluster?: Cluster;
  mempoolHost: string;
  mempoolUrl: URL;
  network: string;
  secureHost = true;
  secureMempoolHost = true;
  canonicalHost: string;
  networkName: string;

  seoQueueLength: number = 0;
  unfurlQueueLength: number = 0;

  constructor() {
    this.app = express();
    this.mempoolHost = config.MEMPOOL.HTTP_HOST + (config.MEMPOOL.HTTP_PORT ? ':' + config.MEMPOOL.HTTP_PORT : '');
    this.mempoolUrl = new URL(this.mempoolHost);
    this.secureHost = config.SERVER.HOST.startsWith('https');
    this.secureMempoolHost = config.MEMPOOL.HTTP_HOST.startsWith('https');
    this.network = config.MEMPOOL.NETWORK || 'bitcoin';
    this.networkName = networks[this.network].networkName || capitalize(this.network);

    let canonical;
    switch(config.MEMPOOL.NETWORK) {
      case "liquid":
        canonical = "https://liquid.network"
        break;
      case "onbtc":
        canonical = "https://bitcoin.gob.sv"
        break;
      default:
        canonical = "https://mempool.space"
    }
    this.canonicalHost = canonical;

    this.startServer();

    setTimeout(async () => {
      logger.info(`killing myself now`);
      await this.stopServer();
      process.exit(0);
    }, 3600_000 * (1 + Math.random()))
  }

  async startServer() {
    this.app
      .use((req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        next();
      })
      .use(express.urlencoded({ extended: true }))
      .use(express.text())
      ;

    if (puppeteerEnabled) {
      this.cluster = await Cluster.launch({
          concurrency: ReusablePage,
          maxConcurrency: config.PUPPETEER.CLUSTER_SIZE,
          puppeteerOptions: puppeteerConfig,
      });
      await this.cluster?.task(async (args) => { return this.clusterTask(args) });
      this.ssrCluster = await Cluster.launch({
        concurrency: ReusableSSRPage,
        maxConcurrency: config.PUPPETEER.CLUSTER_SIZE,
        puppeteerOptions: puppeteerConfig,
      });
      await this.ssrCluster?.task(async (args) => { return this.ssrClusterTask(args) });
    }

    this.setUpRoutes();

    this.server = http.createServer(this.app);

    this.server.listen(config.SERVER.HTTP_PORT, () => {
      logger.info(`Mempool Unfurl Server is running on port ${config.SERVER.HTTP_PORT}`);
    });
  }

  async stopServer() {
    if (this.cluster) {
      await this.cluster.idle();
      await this.cluster.close();
    }
    if (this.ssrCluster) {
      await this.ssrCluster.idle();
      await this.ssrCluster.close();
    }
    if (this.server) {
      await this.server.close();
    }
  }

  setUpRoutes() {
    this.app.set('view engine', 'ejs');

    if (puppeteerEnabled) {
      this.app.get('/unfurl/render*', async (req, res) => { return this.renderPreview(req, res) })
      this.app.get('/render*', async (req, res) => { return this.renderPreview(req, res) })
    } else {
      this.app.get('/unfurl/render*', async (req, res) => { return this.renderDisabled(req, res) })
      this.app.get('/render*', async (req, res) => { return this.renderDisabled(req, res) })
    }
    this.app.get('/unfurl*', (req, res) => { return this.renderHTML(req, res, true) })
    this.app.get('/slurp*', (req, res) => { return this.renderHTML(req, res, false) })
    this.app.get('/sip*', (req, res) => { return this.renderSip(req, res) })
    this.app.get('*', (req, res) => { return this.renderHTML(req, res, false) })
  }

  async clusterTask({ page, data: { url, path, action, reqUrl } }) {
    const start = Date.now();
    try {
      logger.info(`rendering "${reqUrl}" on tab ${page.clusterGroup}:${page.index}`);
      const urlParts = parseLanguageUrl(path);
      if (page.language !== urlParts.lang) {
        // switch language
        page.language = urlParts.lang;
        const localizedUrl = urlParts.lang ? `${this.mempoolHost}/${urlParts.lang}${urlParts.path}` : `${this.mempoolHost}${urlParts.path}` ;
        await page.goto(localizedUrl, { waitUntil: "load" });
      } else {
        const loaded = await page.evaluate(async (path) => {
          if (window['ogService']) {
            window['ogService'].loadPage(path);
            return true;
          } else {
            return false;
          }
        }, urlParts.path);
        if (!loaded) {
          throw new Error('failed to access open graph service');
        }
      }

      // wait for preview component to initialize
      let success;
      await page.waitForSelector('meta[property="og:preview:loading"]', { timeout: config.PUPPETEER.RENDER_TIMEOUT || 3000 })
      success = await Promise.race([
        page.waitForSelector('meta[property="og:preview:ready"]', { timeout: config.PUPPETEER.RENDER_TIMEOUT || 3000 }).then(() => true),
        page.waitForSelector('meta[property="og:preview:fail"]', { timeout: config.PUPPETEER.RENDER_TIMEOUT || 3000 }).then(() => false)
      ])
      if (success === true) {
        const screenshot = await page.screenshot({
          captureBeyondViewport: false,
          clip: { width: 1200, height: 600, x: 0, y: 0, scale: 1 },
        });
        logger.info(`rendered unfurl img in ${Date.now() - start}ms for "${reqUrl}" on tab ${page.clusterGroup}:${page.index}`);
        return screenshot;
      } else if (success === false) {
        logger.warn(`failed to render ${reqUrl} for ${action} due to client-side error, e.g. requested an invalid txid`);
        page.repairRequested = true;
      } else {
        logger.warn(`failed to render ${reqUrl} for ${action} due to puppeteer timeout`);
        page.repairRequested = true;
      }
    } catch (e) {
      logger.err(`failed to render ${reqUrl} for ${action}: ` + (e instanceof Error ? e.message : `${e}`));
      page.repairRequested = true;
    }
  }

  async ssrClusterTask({ page, data: { url, path, action, reqUrl } }) {
    const start = Date.now();
    try {
      logger.info(`slurping "${reqUrl}" on tab ${page.clusterGroup}:${page.index}`);
      const urlParts = parseLanguageUrl(path);
      if (page.language !== urlParts.lang) {
        // switch language
        page.language = urlParts.lang;
        const localizedUrl = urlParts.lang ? `${this.mempoolHost}/${urlParts.lang}${urlParts.path}` : `${this.mempoolHost}${urlParts.path}`;
        await page.goto(localizedUrl, { waitUntil: "load" });
      } else {
        const loaded = await page.evaluate(async (path) => {
          if (window['ogService']) {
            window['ogService'].loadPage(path);
            return true;
          } else {
            return false;
          }
        }, urlParts.path);
        if (!loaded) {
          throw new Error('failed to access open graph service');
        }
      }

      await page.waitForNetworkIdle({
        timeout: config.PUPPETEER.RENDER_TIMEOUT || 3000,
      });
      const is404 = await page.evaluate(async () => {
        return !!window['soft404'];
      });
      if (is404) {
        logger.info(`slurp 404 in ${Date.now() - start}ms for "${reqUrl}" on tab ${page.clusterGroup}:${page.index}`);
        return '404';
      } else {
        let html = await page.content();
        logger.info(`rendered slurp in ${Date.now() - start}ms for "${reqUrl}" on tab ${page.clusterGroup}:${page.index}`);
        return html;
      }
    } catch (e) {
      if (e instanceof TimeoutError) {
        let html = await page.content();
        logger.info(`rendered partial slurp in ${Date.now() - start}ms for "${reqUrl}" on tab ${page.clusterGroup}:${page.index}`);
        return html;
      } else {
        logger.err(`failed to render ${reqUrl} for ${action}: ` + (e instanceof Error ? e.message : `${e}`));
        page.repairRequested = true;
      }
    }
  }

  async renderDisabled(req, res) {
    res.status(500).send("preview rendering disabled");
  }

  async renderPreview(req, res) {
    try {
      this.unfurlQueueLength++;
      const start = Date.now();
      const rawPath = req.params[0];

      let img = null;

      const { lang, path } = parseLanguageUrl(rawPath);
      const matchedRoute = matchRoute(this.network, path);

      // don't bother unless the route is definitely renderable
      if (rawPath.includes('/preview/') && matchedRoute.render) {
        img = await this.cluster?.execute({ url: this.mempoolHost + rawPath, path: rawPath, action: 'screenshot', reqUrl: req.url });
        logger.info(`unfurl returned "${req.url}" in ${Date.now() - start}ms | ${this.unfurlQueueLength - 1} tasks in queue`);
      } else {
        logger.info('rendering not enabled for page "' + req.url + '"');
      }

      if (!img) {
        // send local fallback image file
        res.set('Cache-control', 'no-cache');
        res.sendFile(nodejsPath.join(__dirname, matchedRoute.fallbackImg));
      } else {
        res.contentType('image/png');
        res.send(img);
      }
    } catch (e) {
      logger.err(e instanceof Error ? e.message : `${e} ${req.params[0]}`);
      res.status(500).send(e instanceof Error ? e.message : e);
    } finally {
      this.unfurlQueueLength--;
    }
  }

  async renderHTML(req, res, unfurl: boolean = false) {
    // drop requests for static files
    const rawPath = req.params[0];
    const match = rawPath.match(/\.[\w]+$/);
    if (match?.length && match[0] !== '.html'
      || rawPath.startsWith('/api/v1/donations/images')
      || rawPath.startsWith('/api/v1/contributors/images')
      || rawPath.startsWith('/api/v1/translators/images')
      || rawPath.startsWith('/resources/profile')
    ) {
      if (unfurl) {
        res.status(404).send();
        return;
      } else {
        logger.info('proxying resource "' + req.url + '"');
        if (this.secureMempoolHost) {
          https.get(this.mempoolHost + rawPath, { headers: { 'user-agent': 'mempoolunfurl' }}, (got) => {
            res.writeHead(got.statusCode, got.headers);
            return got.pipe(res);
          });
        } else {
          http.get(this.mempoolHost + rawPath, { headers: { 'user-agent': 'mempoolunfurl' }}, (got) => {
            res.writeHead(got.statusCode, got.headers);
            return got.pipe(res);
          });
        }
        return;
      }
    }

    let result = '';
    try {
      if (unfurl) {
        logger.info('unfurling "' + req.url + '"');
        result = await this.renderUnfurlMeta(rawPath);
      } else {
        this.seoQueueLength++;
        const start = Date.now();
        result = await this.renderSEOPage(rawPath, req.url);
        logger.info(`slurp returned "${req.url}" in ${Date.now() - start}ms | ${this.seoQueueLength - 1} tasks in queue`);
      }
      if (result && result.length) {
        if (result === '404') {
          res.status(404).send();
        } else {
          res.send(result);
        }
      } else {
        res.status(500).send();
      }
    } catch (e) {
      logger.err(e instanceof Error ? e.message : `${e} ${req.params[0]}`);
      res.status(500).send(e instanceof Error ? e.message : e);
    } finally {
      if (!unfurl) {
        this.seoQueueLength--;
      }
    }
  }

  async renderUnfurlMeta(rawPath: string): Promise<string> {
    const { lang, path } = parseLanguageUrl(rawPath);
    const matchedRoute = matchRoute(this.network, path);
    let ogImageUrl = config.SERVER.HOST + (matchedRoute.staticImg || matchedRoute.fallbackImg);
    let ogTitle = 'The Mempool Open Source Project®';
    let ogDescription = 'Explore the full Bitcoin ecosystem with mempool.space';

    const canonical = this.canonicalHost + rawPath;

    if (matchedRoute.render) {
      ogImageUrl = `${config.SERVER.HOST}/render/${lang || 'en'}/preview${path}`;
      ogTitle = `${this.networkName} ${matchedRoute.networkMode !== 'mainnet' ? capitalize(matchedRoute.networkMode) + ' ' : ''}${matchedRoute.title}`;
    } else {
      ogTitle = networks[this.network].title;
    }
    if (matchedRoute.description) {
      ogDescription = matchedRoute.description;
    }

    return `<!doctype html>
<html lang="en-US" dir="ltr">
  <head>
    <meta charset="utf-8">
    <title>${ogTitle}</title>
    <link rel="canonical" href="${canonical}" />
    <meta name="description" content="${ogDescription}"/>
    <meta property="og:image" content="${ogImageUrl}"/>
    <meta property="og:image:type" content="image/png"/>
    <meta property="og:image:width" content="${matchedRoute.render ? 1200 : 1000}"/>
    <meta property="og:image:height" content="${matchedRoute.render ? 600 : 500}"/>
    <meta property="og:title" content="${ogTitle}">
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:site" content="@mempool">
    <meta property="twitter:creator" content="@mempool">
    <meta property="twitter:title" content="${ogTitle}">
    <meta property="twitter:description" content="${ogDescription}"/>
    <meta property="twitter:image:src" content="${ogImageUrl}"/>
    <meta property="twitter:domain" content="mempool.space">
  </head>
  <body></body>
</html>`;
  }

  async renderSEOPage(rawPath: string, reqUrl: string): Promise<string> {
    let html = await this.ssrCluster?.execute({ url: this.mempoolHost + rawPath, path: rawPath, action: 'ssr', reqUrl });
    // remove javascript to prevent double hydration
    if (html && html.length) {
      html = html.replaceAll(/<script.*<\/script>/g, "");
      html = html.replaceAll(this.mempoolHost, this.canonicalHost);
    }
    return html;
  }

  async renderSip(req, res): Promise<void> {
    const start = Date.now();
    const rawPath = req.params[0];
    const { lang, path } = parseLanguageUrl(rawPath);
    const matchedRoute = matchRoute(this.network, path, 'sip');

    let ogImageUrl = config.SERVER.HOST + (matchedRoute.staticImg || matchedRoute.fallbackImg);
    let ogTitle = 'The Mempool Open Source Project®';

    const canonical = this.canonicalHost + rawPath;

    if (matchedRoute.render) {
      ogImageUrl = `${config.SERVER.HOST}/render/${lang || 'en'}/preview${path}`;
      ogTitle = `${this.networkName} ${matchedRoute.networkMode !== 'mainnet' ? capitalize(matchedRoute.networkMode) + ' ' : ''}${matchedRoute.title}`;
    }

    if (matchedRoute.sip) {
      logger.info(`sipping "${req.url}"`);
      try {
        const data = await matchedRoute.sip.getData(matchedRoute.params);
        logger.info(`sip data fetched for "${req.url}" in ${Date.now() - start}ms`);
        res.render(matchedRoute.sip.template, { canonicalHost: this.canonicalHost, canonical, ogImageUrl, ogTitle, matchedRoute, data });
        logger.info(`sip returned "${req.url}" in ${Date.now() - start}ms`);
      } catch (e) {
        logger.err(`failed to sip ${req.url}: ` + (e instanceof Error ? e.message : `${e}`));
        res.status(500).send();
      }
    } else {
      return this.renderHTML(req, res, false);
    }
  }
}

const server = new Server();

process.on('SIGTERM', async () => {
  logger.info('Shutting down Mempool Unfurl Server');
  await server.stopServer();
  process.exit(0);
});

function capitalize(str) {
  if (str === 'onbtc') {
    return 'ONBTC';
  }
  if (str && str.length) {
    return str[0].toUpperCase() + str.slice(1);
  } else {
    return str;
  }
}
