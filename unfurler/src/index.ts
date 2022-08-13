import express from "express";
import { Application, Request, Response, NextFunction } from 'express';
import * as http from 'http';
import config from './config';
import { Cluster } from 'puppeteer-cluster';
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
        concurrency: Cluster.CONCURRENCY_CONTEXT,
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

  async clusterTask({ page, data: { url, action } }) {
    await page.goto(url, { waitUntil: "networkidle0" });
    switch (action) {
      case 'screenshot': {
        await page.evaluate(async () => {
          // wait for all images to finish loading
          const imgs = Array.from(document.querySelectorAll("img"));
          await Promise.all([
            document.fonts.ready,
            ...imgs.map((img) => {
              if (img.complete) {
                if (img.naturalHeight !== 0) return;
                throw new Error("Image failed to load");
              }
              return new Promise((resolve, reject) => {
                img.addEventListener("load", resolve);
                img.addEventListener("error", reject);
              });
            }),
          ]);
        });
        const waitForReady = await page.$('meta[property="og:loading"]');
        const alreadyReady = await page.$('meta[property="og:ready"]');
        if (waitForReady != null && alreadyReady == null) {
          try {
            await page.waitForSelector('meta[property="og:ready]"', { timeout: 10000 });
          } catch (e) {
            // probably timed out
          }
        }
        return page.screenshot();
      } break;
      default: {
        try {
          await page.waitForSelector('meta[property="og:title"]', { timeout: 10000 })
          const tag = await page.$('meta[property="og:title"]');
        } catch (e) {
          // probably timed out
        }
        return page.content();
      }
    }
  }

  async renderPreview(req, res) {
    try {
      // strip default language code for compatibility
      const path = req.params[0].replace('/en/', '/');
      const img = await this.cluster?.execute({ url: this.mempoolHost + path, action: 'screenshot' });

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
      let html = await this.cluster?.execute({ url: this.mempoolHost + req.params[0], action: 'html' });

      res.send(html)
    } catch (e) {
      console.log(e);
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }
}

const server = new Server();
