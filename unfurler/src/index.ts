import express from "express";
import { Application, Request, Response, NextFunction } from 'express';
import * as http from 'http';
import config from './config';
import { Cluster } from 'puppeteer-cluster';
import ReusablePage from './concurrency/ReusablePage';
import { parseLanguageUrl } from './language/lang';
const puppeteerConfig = require('../puppeteer.config.json');

if (config.PUPPETEER.EXEC_PATH) {
  puppeteerConfig.executablePath = config.PUPPETEER.EXEC_PATH;
}

class Server {
  private server: http.Server | undefined;
  private app: Application;
  cluster?: Cluster;
  mempoolHost: string;
  network: string;
  defaultImageUrl: string;

  constructor() {
    this.app = express();
    this.mempoolHost = config.MEMPOOL.HTTP_HOST + (config.MEMPOOL.HTTP_PORT ? ':' + config.MEMPOOL.HTTP_PORT : '');
    this.network = config.MEMPOOL.NETWORK || 'bitcoin';
    this.defaultImageUrl = this.getDefaultImageUrl();
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

    this.cluster = await Cluster.launch({
        concurrency: ReusablePage,
        maxConcurrency: config.PUPPETEER.CLUSTER_SIZE,
        puppeteerOptions: puppeteerConfig,
    });
    await this.cluster?.task(async (args) => { return this.clusterTask(args) });

    this.setUpRoutes();

    this.server = http.createServer(this.app);

    this.server.listen(config.SERVER.HTTP_PORT, () => {
      console.log(`Mempool Unfurl Server is running on port ${config.SERVER.HTTP_PORT}`);
    });

    this.initClusterPages();
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
    this.app.get('/render*', async (req, res) => { return this.renderPreview(req, res) })
    this.app.get('*', (req, res) => { return this.renderHTML(req, res) })
  }

  async initClusterPages() {
    for (let i = 0; i < config.PUPPETEER.CLUSTER_SIZE; i++) {
      this.cluster?.execute({ action: 'init' });
    }
  }

  async clusterTask({ page, data: { url, path, action } }) {
    if (action === 'init') {
      return;
    }
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

      const waitForReady = await page.$('meta[property="og:preview:loading"]');
      let success = true;
      if (waitForReady != null) {
        success = await Promise.race([
          page.waitForSelector('meta[property="og:preview:ready"]', { timeout: config.PUPPETEER.RENDER_TIMEOUT || 3000 }).then(() => true),
          page.waitForSelector('meta[property="og:preview:fail"]', { timeout: config.PUPPETEER.RENDER_TIMEOUT || 3000 }).then(() => false)
        ])
      }
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

  async renderPreview(req, res) {
    try {
      const path = req.params[0]
      const img = await this.cluster?.execute({ url: this.mempoolHost + path, path: path, action: 'screenshot' });

      if (!img) {
        res.status(500).send('failed to render page preview');
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

    let previewSupported = true;
    let mode = 'mainnet'
    let ogImageUrl = this.defaultImageUrl;
    let ogTitle;
    const { lang, path } = parseLanguageUrl(rawPath);
    const parts = path.slice(1).split('/');

    // handle network mode modifiers
    if (['testnet', 'signet'].includes(parts[0])) {
      mode = parts.shift();
    }

    // handle supported preview routes
    if (parts[0] === 'block') {
      ogTitle = `Block: ${parts[1]}`;
    } else if (parts[0] === 'address') {
      ogTitle = `Address: ${parts[1]}`;
    } else {
      previewSupported = false;
    }

    if (previewSupported) {
      ogImageUrl = `${config.SERVER.HOST}/render/${lang || 'en'}/preview${path}`;
      ogTitle = `${this.network ? capitalize(this.network) + ' ' : ''}${mode !== 'mainnet' ? capitalize(mode) + ' ' : ''}${ogTitle}`;
    } else {
      ogTitle = 'The Mempool Open Source Project™';
    }

    res.send(`
      <!doctype html>
      <html lang="en-US" dir="ltr">
      <head>
        <meta charset="utf-8">
        <title>${ogTitle}</title>
        <meta name="description" content="The Mempool Open Source Project™ - our self-hosted explorer for the ${capitalize(this.network)} community."/>
        <meta property="og:image" content="${ogImageUrl}"/>
        <meta property="og:image:type" content="image/png"/>
        <meta property="og:image:width" content="${previewSupported ? 1200 : 1000}"/>
        <meta property="og:image:height" content="${previewSupported ? 600 : 500}"/>
        <meta property="og:title" content="${ogTitle}">
        <meta property="twitter:card" content="summary_large_image">
        <meta property="twitter:site" content="@mempool">
        <meta property="twitter:creator" content="@mempool">
        <meta property="twitter:title" content="${ogTitle}">
        <meta property="twitter:description" content="Our self-hosted mempool explorer for the ${capitalize(this.network)} community."/>
        <meta property="twitter:image:src" content="${ogImageUrl}"/>
        <meta property="twitter:domain" content="mempool.space">
      <body></body>
      </html>
    `);
  }

  getDefaultImageUrl() {
    switch (this.network) {
      case 'liquid':
        return this.mempoolHost + '/resources/liquid/liquid-network-preview.png';
      case 'bisq':
        return this.mempoolHost + '/resources/bisq/bisq-markets-preview.png';
      default:
        return this.mempoolHost + '/resources/mempool-space-preview.png';
    }
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
