import config from '../config';
import { Renderer } from '../renderer';
import logger from '../logger';
import { parseLanguageUrl } from '../language/lang';

import { Cluster } from 'puppeteer-cluster';
import ReusablePage from './concurrency/ReusablePage';
const puppeteerConfig = require('../../puppeteer.config.json');

if (config.PUPPETEER.EXEC_PATH) {
  puppeteerConfig.executablePath = config.PUPPETEER.EXEC_PATH;
}

class PuppeteerRenderer implements Renderer {
  cluster?: Cluster;
  mempoolHost = '';
  
  async init(host: string): Promise<void> {
    this.mempoolHost = host;
    this.cluster = await Cluster.launch({
      concurrency: ReusablePage,
      maxConcurrency: config.PUPPETEER.CLUSTER_SIZE,
      puppeteerOptions: puppeteerConfig,
    });
    await this.cluster?.task(async (args) => { return this.clusterTask(args) });
  }

  async stop(): Promise<void> {
    await this.cluster?.idle();
    await this.cluster?.close();
  }

  async render(path: string, reqUrl: string): Promise<Uint8Array | undefined> {
    return this.cluster?.execute({ path, reqUrl });
  }

  async clusterTask({ page, data: { path, reqUrl } }): Promise<Uint8Array | undefined> {
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
      await page.waitForSelector('meta[property="og:preview:loading"]', { timeout: config.PUPPETEER.RENDER_TIMEOUT || 3000 })
      const success = await Promise.race([
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
        logger.warn(`failed to render ${reqUrl} for screenshot due to client-side error, e.g. requested an invalid txid`);
        page.repairRequested = true;
      } else {
        logger.warn(`failed to render ${reqUrl} for screenshot due to puppeteer timeout`);
        page.repairRequested = true;
      }
    } catch (e) {
      logger.err(`failed to render ${reqUrl} for screenshot: ` + (e instanceof Error ? e.message : `${e}`));
      page.repairRequested = true;
    }
  }
}

export default new PuppeteerRenderer();