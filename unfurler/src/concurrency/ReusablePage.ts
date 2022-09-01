import * as puppeteer from 'puppeteer';
import ConcurrencyImplementation from 'puppeteer-cluster/dist/concurrency/ConcurrencyImplementation';
import { timeoutExecute } from 'puppeteer-cluster/dist/util';

import config from '../config';
const mempoolHost = config.MEMPOOL.HTTP_HOST + (config.MEMPOOL.HTTP_PORT ? ':' + config.MEMPOOL.HTTP_PORT : '');

const BROWSER_TIMEOUT = 8000;
// maximum lifetime of a single page session
const maxAgeMs = (config.PUPPETEER.MAX_PAGE_AGE || (24 * 60 * 60)) * 1000;
const maxConcurrency = config.PUPPETEER.CLUSTER_SIZE;

interface RepairablePage extends puppeteer.Page {
  repairRequested?: boolean;
  language?: string | null;
  createdAt?: number;
  free?: boolean;
  index?: number;
}

interface ResourceData {
  page: RepairablePage;
}

export default class ReusablePage extends ConcurrencyImplementation {

  protected browser: puppeteer.Browser | null = null;
  protected pages: RepairablePage[] = [];
  private repairing: boolean = false;
  private repairRequested: boolean = false;
  private openInstances: number = 0;
  private waitingForRepairResolvers: (() => void)[] = [];

  public constructor(options: puppeteer.LaunchOptions, puppeteer: any) {
    super(options, puppeteer);
  }

  private async repair() {
    if (this.openInstances !== 0 || this.repairing) {
      // already repairing or there are still pages open? wait for start/finish
      await new Promise<void>(resolve => this.waitingForRepairResolvers.push(resolve));
      return;
    }

    this.repairing = true;
    console.log('Starting repair');

    try {
      // will probably fail, but just in case the repair was not necessary
      await (<puppeteer.Browser>this.browser).close();
    } catch (e) {
      console.log('Unable to close browser.');
    }

    try {
      await this.init();
    } catch (err) {
      throw new Error('Unable to restart chrome.');
    }
    this.repairRequested = false;
    this.repairing = false;
    this.waitingForRepairResolvers.forEach(resolve => resolve());
    this.waitingForRepairResolvers = [];
  }

  public async init() {
    this.browser = await this.puppeteer.launch(this.options);
    const promises = []
    for (let i = 0; i < maxConcurrency; i++) {
      const newPage = await this.initPage();
      newPage.index = this.pages.length;
      console.log('initialized page ', newPage.index);
      this.pages.push(newPage);
    }
  }

  public async close() {
    await (this.browser as puppeteer.Browser).close();
  }

  protected async initPage(): Promise<RepairablePage> {
    const page = await (this.browser as puppeteer.Browser).newPage() as RepairablePage;
    page.language = null;
    page.createdAt = Date.now();
    const defaultUrl = mempoolHost + '/preview/block/1';
    page.on('pageerror', (err) => {
      page.repairRequested = true;
    });
    await page.goto(defaultUrl, { waitUntil: "load" });
    await Promise.race([
      page.waitForSelector('meta[property="og:preview:ready"]', { timeout: config.PUPPETEER.RENDER_TIMEOUT || 3000 }).then(() => true),
      page.waitForSelector('meta[property="og:preview:fail"]', { timeout: config.PUPPETEER.RENDER_TIMEOUT || 3000 }).then(() => false)
    ])
    page.free = true;
    return page
  }

  protected async createResources(): Promise<ResourceData> {
    const page = this.pages.find(p => p.free);
    if (!page) {
      console.log('no free pages!')
      throw new Error('no pages available');
    } else {
      page.free = false;
      return { page };
    }
  }

  protected async repairPage(page) {
    // create a new page
    const newPage = await this.initPage();
    newPage.free = true;
    // replace the old page
    newPage.index = page.index;
    this.pages.splice(page.index, 1, newPage);
    // clean up the old page
    try {
      await page.goto('about:blank', {timeout: 200}); // prevents memory leak (maybe?)
    } catch (e) {
      console.log('unexpected page repair error');
    }
    await page.close();
    return newPage;
  }

  public async workerInstance() {
    let resources: ResourceData;

    return {
      jobInstance: async () => {
        await timeoutExecute(BROWSER_TIMEOUT, (async () => {
          resources = await this.createResources();
        })());
        this.openInstances += 1;

        return {
          resources,

          close: async () => {
            this.openInstances -= 1; // decrement first in case of error
            if (resources?.page != null) {
              if (resources.page.repairRequested || (Date.now() - (resources.page.createdAt || 0) > maxAgeMs)) {
                resources.page = await this.repairPage(resources.page);
              } else {
                resources.page.free = true;
              }
            }

            if (this.repairRequested) {
              await this.repair();
            }
          },
        };
      },

      close: async () => {},

      repair: async () => {
        await this.repairPage(resources.page);
      },
    };
  }
}
