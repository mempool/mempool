import express from "express";
import { Application, Request, Response, NextFunction } from 'express';
import * as http from 'http';
import * as https from 'https';
import config from './config';
import { parseLanguageUrl } from './language/lang';
import { matchRoute, networks } from './routes';
import nodejsPath from 'path';
import logger from './logger';
import { Renderer } from "./renderer";
import { SeoRenderer } from "./seoRenderer";


class Server {
  private server: http.Server | undefined;
  private app: Application;
  mempoolHost: string;
  mempoolUrl: URL;
  network: string;
  secureHost = true;
  secureMempoolHost = true;
  canonicalHost: string;
  networkName: string;
  renderer?: Renderer;
  renderingEnabled = false;
  seoRenderer?: SeoRenderer;
  seoRenderingEnabled = false;

  seoQueueLength = 0;
  unfurlQueueLength = 0;

  constructor() {
    this.app = express();
    this.mempoolHost = config.MEMPOOL.HTTP_HOST + (config.MEMPOOL.HTTP_PORT ? ':' + config.MEMPOOL.HTTP_PORT : '');
    this.mempoolUrl = new URL(this.mempoolHost);
    this.secureHost = config.SERVER.HOST.startsWith('https');
    this.secureMempoolHost = config.MEMPOOL.HTTP_HOST.startsWith('https');
    this.network = config.MEMPOOL.NETWORK || 'bitcoin';
    this.networkName = networks[this.network].networkName || capitalize(this.network);

    this.loadOptionalDependencies();

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

  private loadOptionalDependencies() {
    // Try Puppeteer
    try {
      if (config.PUPPETEER.ENABLED && config.PUPPETEER.CLUSTER_SIZE > 0) {
        this.renderer = require('./puppeteer/renderer').default;
        this.renderingEnabled = true;
        this.seoRenderer = require('./puppeteer/seoRenderer').default;
        this.seoRenderingEnabled = true;
        logger.info('Puppeteer dependencies loaded');
      }
    } catch (error) {
      logger.info('Puppeteer not available');
    }

    if (!this.renderingEnabled && config.CANVAS.ENABLED) {
      // Try Canvas Renderer
      try {
          this.renderer = require('./canvas/renderer').default;
          this.renderingEnabled = true;
          logger.info('Canvas Renderer dependencies loaded');
      } catch (error) {
        logger.info('Canvas Renderer not available');
      }
    }
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

    if (this.renderingEnabled) {
      await this.renderer?.init(this.mempoolHost);
    }
    if (this.seoRenderingEnabled) {
      await this.seoRenderer?.init(this.mempoolHost);
    }

    this.setUpRoutes();

    this.server = http.createServer(this.app);

    this.server.listen(config.SERVER.HTTP_PORT, () => {
      logger.info(`Mempool Unfurl Server is running on port ${config.SERVER.HTTP_PORT}`);
    });
  }

  async stopServer() {
    await this.renderer?.stop();
    await this.seoRenderer?.stop();
    await this.server?.close();
  }

  setUpRoutes() {
    this.app.set('view engine', 'ejs');

    if (this.renderingEnabled) {
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

  async renderDisabled(req, res) {
    res.status(500).send("preview rendering disabled");
  }

  async renderPreview(req, res) {
    try {
      this.unfurlQueueLength++;
      const start = Date.now();
      const rawPath = req.params[0];

      let img: Uint8Array | undefined = undefined;

      const { lang, path } = parseLanguageUrl(rawPath);
      const matchedRoute = matchRoute(this.network, path);

      // don't bother unless the route is definitely renderable
      if (rawPath.includes('/preview/') && matchedRoute.render) {
        img = await this.renderer?.render(rawPath, req.url, matchedRoute);
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
      } else if (this.seoRenderingEnabled) {
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
    let html = await this.seoRenderer?.render(rawPath, reqUrl) || '';
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
