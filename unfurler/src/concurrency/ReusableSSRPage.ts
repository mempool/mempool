import * as puppeteer from 'puppeteer';
import { timeoutExecute } from 'puppeteer-cluster/dist/util';
import logger from '../logger';
import config from '../config';
import ReusablePage, { RepairablePage } from './ReusablePage';
const mempoolHost = config.MEMPOOL.HTTP_HOST + (config.MEMPOOL.HTTP_PORT ? ':' + config.MEMPOOL.HTTP_PORT : '');

const mockImageBuffer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=", 'base64');

export default class ReusableSSRPage extends ReusablePage {

  public constructor(options: puppeteer.LaunchOptions, puppeteer: any) {
    super(options, puppeteer);
  }

  public async close() {
    await (this.browser as puppeteer.Browser).close();
  }

  protected async initPage(): Promise<RepairablePage> {
    const page = await (this.browser as puppeteer.Browser).newPage() as RepairablePage;
    page.clusterGroup = 'slurper';
    page.language = null;
    page.createdAt = Date.now();
    const defaultUrl = mempoolHost + '/preview/block/1';

    page.on('pageerror', (err) => {
      console.log(err);
      page.repairRequested = true;
    });
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (req.isInterceptResolutionHandled()) {
        return req.continue();
      }
      if (req.resourceType() === 'image') {
        return req.respond({
          contentType: 'image/png',
          headers: {"Access-Control-Allow-Origin": "*"},
          body: mockImageBuffer
        });
      } else if (req.resourceType() === 'media') {
        return req.abort();
      } else {
        return req.continue();
      }
    });
    try {
      await page.goto(defaultUrl, { waitUntil: "networkidle0" });
      await page.waitForSelector('meta[property="og:meta:ready"]', { timeout: config.PUPPETEER.RENDER_TIMEOUT || 3000 });
    } catch (e) {
      logger.err(`failed to load frontend during ssr page initialization ${page.clusterGroup}:${page.index}: ` + (e instanceof Error ? e.message : `${e}`));
      page.repairRequested = true;
    }
    page.free = true;
    return page
  }
}
