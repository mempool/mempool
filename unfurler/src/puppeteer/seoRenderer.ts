import config from '../config';
import logger from '../logger';
import { SeoRenderer } from '../seoRenderer';
import { parseLanguageUrl } from '../language/lang';

import { Cluster } from 'puppeteer-cluster';
import ReusableSSRPage from './concurrency/ReusableSSRPage';
import { TimeoutError } from 'puppeteer';
const puppeteerConfig = require('../../puppeteer.config.json');

if (config.PUPPETEER.EXEC_PATH) {
  puppeteerConfig.executablePath = config.PUPPETEER.EXEC_PATH;
}

class PuppeteerSeoRenderer implements SeoRenderer {
  cluster?: Cluster;
  mempoolHost = '';
  
  async init(host: string): Promise<void> {
    this.mempoolHost = host;
    this.cluster = await Cluster.launch({
      concurrency: ReusableSSRPage,
      maxConcurrency: config.PUPPETEER.CLUSTER_SIZE,
      puppeteerOptions: puppeteerConfig,
    });
    await this.cluster?.task(async (args) => { return this.clusterTask(args) });
  }

  async stop(): Promise<void> {
    await this.cluster?.idle();
    await this.cluster?.close();
  }

  async render(path: string, reqUrl: string): Promise<string | undefined> {
    return this.cluster?.execute({ path, reqUrl });
  }

  async clusterTask({ page, data: { path, reqUrl } }): Promise<string | undefined> {
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
        const html = await page.content();
        logger.info(`rendered slurp in ${Date.now() - start}ms for "${reqUrl}" on tab ${page.clusterGroup}:${page.index}`);
        return html;
      }
    } catch (e) {
      if (e instanceof TimeoutError) {
        const html = await page.content();
        logger.info(`rendered partial slurp in ${Date.now() - start}ms for "${reqUrl}" on tab ${page.clusterGroup}:${page.index}`);
        return html;
      } else {
        logger.err(`failed to render ${reqUrl} for ssr: ` + (e instanceof Error ? e.message : `${e}`));
        page.repairRequested = true;
      }
    }
  }
}

export default new PuppeteerSeoRenderer();