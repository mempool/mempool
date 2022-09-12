import express from "express";
import { Application, Request, Response, NextFunction } from 'express';
import * as http from 'http';
import * as https from 'https';
import config from './config';
import { Cluster } from 'puppeteer-cluster';
import ReusablePage from './concurrency/ReusablePage';
import { parseLanguageUrl } from './language/lang';
import { matchRoute } from './routes';
const puppeteerConfig = require('../puppeteer.config.json');

if (config.PUPPETEER.EXEC_PATH) {
  puppeteerConfig.executablePath = config.PUPPETEER.EXEC_PATH;
}

const puppeteerEnabled = config.PUPPETEER.ENABLED && (config.PUPPETEER.CLUSTER_SIZE > 0);

class Server {
  private server: http.Server | undefined;
  private app: Application;
  cluster?: Cluster;
  mempoolHost: string;
  network: string;
  secureHost = true;

  constructor() {
    this.app = express();
    this.mempoolHost = config.MEMPOOL.HTTP_HOST + (config.MEMPOOL.HTTP_PORT ? ':' + config.MEMPOOL.HTTP_PORT : '');
    this.secureHost = config.SERVER.HOST.startsWith('https');
    this.network = config.MEMPOOL.NETWORK || 'bitcoin';
    this.startServer();
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
    }

    this.setUpRoutes();

    this.server = http.createServer(this.app);

    this.server.listen(config.SERVER.HTTP_PORT, () => {
      console.log(`Mempool Unfurl Server is running on port ${config.SERVER.HTTP_PORT}`);
    });
  }

  async stopServer() {
    if (this.cluster) {
      await this.cluster.idle();
      await this.cluster.close();
    }
    if (this.server) {
      await this.server.close();
    }
  }

  setUpRoutes() {
    if (puppeteerEnabled) {
      this.app.get('/render*', async (req, res) => { return this.renderPreview(req, res) })
    } else {
      this.app.get('/render*', async (req, res) => { return this.renderDisabled(req, res) })
    }
    this.app.get('*', (req, res) => { return this.renderHTML(req, res) })
  }

  async clusterTask({ page, data: { url, path, action } }) {
    try {
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
      await page.waitForSelector('meta[property="og:preview:loading"]', { timeout: config.PUPPETEER.RENDER_TIMEOUT || 3000 })
      let success = false;
      success = await Promise.race([
        page.waitForSelector('meta[property="og:preview:ready"]', { timeout: config.PUPPETEER.RENDER_TIMEOUT || 3000 }).then(() => true),
        page.waitForSelector('meta[property="og:preview:fail"]', { timeout: config.PUPPETEER.RENDER_TIMEOUT || 3000 }).then(() => false)
      ])
      if (success) {
        const screenshot = await page.screenshot();
        return screenshot;
      } else {
        console.log(`failed to render page preview for ${action} due to client-side error. probably requested an invalid ID`);
        page.repairRequested = true;
      }
    } catch (e) {
      console.log(`failed to render page for ${action}`, e instanceof Error ? e.message : e);
      page.repairRequested = true;
    }
  }

  async renderDisabled(req, res) {
    res.status(500).send("preview rendering disabled");
  }

  async renderPreview(req, res) {
    try {
      const rawPath = req.params[0];

      let img = null;

      const { lang, path } = parseLanguageUrl(rawPath);
      const matchedRoute = matchRoute(this.network, path);

      // don't bother unless the route is definitely renderable
      if (rawPath.includes('/preview/') && matchedRoute.render) {
        img = await this.cluster?.execute({ url: this.mempoolHost + rawPath, path: rawPath, action: 'screenshot' });
      }

      if (!img) {
        // proxy fallback image from the frontend
        if (this.secureHost) {
          https.get(config.SERVER.HOST + matchedRoute.fallbackImg, (got) => got.pipe(res));
        } else {
          http.get(config.SERVER.HOST + matchedRoute.fallbackImg, (got) => got.pipe(res));
        }
      } else {
        res.contentType('image/png');
        res.send(img);
      }
    } catch (e) {
      console.log(e);
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  async renderHTML(req, res) {
    // drop requests for static files
    const rawPath = req.params[0];
    const match = rawPath.match(/\.[\w]+$/);
    if (match?.length && match[0] !== '.html') {
      res.status(404).send();
      return;
    }

    const { lang, path } = parseLanguageUrl(rawPath);
    const matchedRoute = matchRoute(this.network, path);
    let ogImageUrl = config.SERVER.HOST + (matchedRoute.staticImg || matchedRoute.fallbackImg);
    let ogTitle = 'The Mempool Open Source Project™';

    if (matchedRoute.render) {
      ogImageUrl = `${config.SERVER.HOST}/render/${lang || 'en'}/preview${path}`;
      ogTitle = `${this.network ? capitalize(this.network) + ' ' : ''}${matchedRoute.networkMode !== 'mainnet' ? capitalize(matchedRoute.networkMode) + ' ' : ''}${matchedRoute.title}`;
    }

    res.send(`
      <!doctype html>
      <html lang="en-US" dir="ltr">
      <head>
        <meta charset="utf-8">
        <title>${ogTitle}</title>
        <meta name="description" content="The Mempool Open Source Project™ - Explore the full Bitcoin ecosystem with mempool.space™"/>
        <meta property="og:image" content="${ogImageUrl}"/>
        <meta property="og:image:type" content="image/png"/>
        <meta property="og:image:width" content="${matchedRoute.render ? 1200 : 1000}"/>
        <meta property="og:image:height" content="${matchedRoute.render ? 600 : 500}"/>
        <meta property="og:title" content="${ogTitle}">
        <meta property="twitter:card" content="summary_large_image">
        <meta property="twitter:site" content="@mempool">
        <meta property="twitter:creator" content="@mempool">
        <meta property="twitter:title" content="${ogTitle}">
        <meta property="twitter:description" content="Explore the full Bitcoin ecosystem with mempool.space"/>
        <meta property="twitter:image:src" content="${ogImageUrl}"/>
        <meta property="twitter:domain" content="mempool.space">
      <body></body>
      </html>
    `);
  }
}

const server = new Server();

process.on('SIGTERM', async () => {
  console.info('Shutting down Mempool Unfurl Server');
  await server.stopServer();
  process.exit(0);
});

function capitalize(str) {
  if (str && str.length) {
    return str[0].toUpperCase() + str.slice(1);
  } else {
    return str;
  }
}
