import express from "express";
import { Application, Request, Response, NextFunction } from 'express';
import * as http from 'http';
import config from './config';
import { Cluster } from 'puppeteer-cluster';
import ReusablePage from './concurrency/ReusablePage';
const puppeteerConfig = require('../puppeteer.config.json');

if (config.PUPPETEER.EXEC_PATH) {
  puppeteerConfig.executablePath = config.PUPPETEER.EXEC_PATH;
}

class Server {
  private server: http.Server | undefined;
  private app: Application;
  cluster?: Cluster;
  mempoolHost: string;

  constructor() {
    this.app = express();
    this.mempoolHost = config.MEMPOOL.HTTP_HOST + (config.MEMPOOL.HTTP_PORT ? ':' + config.MEMPOOL.HTTP_PORT : '');
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
  }

  setUpRoutes() {
    this.app.get('/render*', async (req, res) => { return this.renderPreview(req, res) })
    this.app.get('*', (req, res) => { return this.renderHTML(req, res) })
  }

  async clusterTask({ page, data: { url, path, action } }) {
    try {
      if (action === 'screenshot' || action === 'html') {
        const loaded = await page.evaluate(async (path) => {
          if (window['ogService']) {
            window['ogService'].loadPage(path);
            return true;
          } else {
            return false;
          }
        }, path)

        if (!loaded) {
          throw new Error('failed to access open graph service');
        }

        if (action === 'screenshot') {
          const waitForReady = await page.$('meta[property="og:preview:loading"]');
          const alreadyReady = await page.$('meta[property="og:preview:ready"]');
          if (waitForReady != null && alreadyReady == null) {
            await page.waitForSelector('meta[property="og:preview:ready"]', { timeout: 8000 });
          }
          return page.screenshot();
        } else if (action === 'html') {
          const alreadyReady = await page.$('meta[property="og:meta:ready"]');
          if (alreadyReady == null) {
            await page.waitForSelector('meta[property="og:meta:ready"]', { timeout: 8000 });
          }
          return page.content();
        }
      }
    } catch (e) {
      console.log(`failed to render page for ${action}`, e instanceof Error ? e.message : e);
      page.repairRequested = true;
    }
  }

  async renderPreview(req, res) {
    try {
      // strip default language code for compatibility
      const path = req.params[0].replace('/en/', '/');
      const img = await this.cluster?.execute({ url: this.mempoolHost + path, path: path, action: 'screenshot' });

      if (!img) {
        throw new Error('failed to render preview image');
      }
      res.contentType('image/png');
      res.send(img);
    } catch (e) {
      console.log(e);
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  async renderHTML(req, res) {
    // drop requests for static files
    const path = req.params[0];
    const match = path.match(/\.[\w]+$/);
    if (match?.length && match[0] !== '.html') {
      res.status(404).send();
      return
    }

    try {
      // strip default language code for compatibility
      const path = req.params[0].replace('/en/', '/');

      let html = await this.cluster?.execute({ url: this.mempoolHost + req.params[0], path: req.params[0], action: 'html' });
      if (!html) {
        throw new Error('failed to render preview image');
      }
      res.send(html);
    } catch (e) {
      console.log(e);
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }
}

const server = new Server();
