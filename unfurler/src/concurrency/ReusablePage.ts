import * as puppeteer from 'puppeteer';
import ConcurrencyImplementation, { ResourceData } from 'puppeteer-cluster/dist/concurrency/ConcurrencyImplementation';
import { timeoutExecute } from 'puppeteer-cluster/dist/util';

import config from '../config';
const mempoolHost = config.MEMPOOL.HTTP_HOST + (config.MEMPOOL.HTTP_PORT ? ':' + config.MEMPOOL.HTTP_PORT : '');

const BROWSER_TIMEOUT = 5000;
// maximum lifetime of a single page session
const maxAgeMs = (config.PUPPETEER.MAX_PAGE_AGE || (24 * 60 * 60)) * 1000;

interface repairablePage extends puppeteer.Page {
  repairRequested?: boolean;
}

export default class ReusablePage extends ConcurrencyImplementation {

  protected browser: puppeteer.Browser | null = null;
  protected currentPage: repairablePage | null = null;
  protected pageCreatedAt: number = 0;
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
      this.browser = await this.puppeteer.launch(this.options) as puppeteer.Browser;
    } catch (err) {
      throw new Error('Unable to restart chrome.');
    }
    this.currentPage = null;
    this.repairRequested = false;
    this.repairing = false;
    this.waitingForRepairResolvers.forEach(resolve => resolve());
    this.waitingForRepairResolvers = [];
    await this.createResources();
  }

  public async init() {
    this.browser = await this.puppeteer.launch(this.options);
  }

  public async close() {
    await (this.browser as puppeteer.Browser).close();
  }

  protected async createResources(): Promise<ResourceData> {
    if (!this.currentPage) {
      this.currentPage = await (this.browser as puppeteer.Browser).newPage();
      this.pageCreatedAt = Date.now();
      const defaultUrl = mempoolHost + '/preview/block/1';
      this.currentPage.on('pageerror', (err) => {
        this.repairRequested = true;
      });
      await this.currentPage.goto(defaultUrl, { waitUntil: "load" });
    }
    return {
      page: this.currentPage
    }
  }

  public async workerInstance() {
    let resources: ResourceData;

    return {
      jobInstance: async () => {
        if (this.repairRequested || this.currentPage?.repairRequested) {
          await this.repair();
        }

        await timeoutExecute(BROWSER_TIMEOUT, (async () => {
          resources = await this.createResources();
        })());
        this.openInstances += 1;

        return {
          resources,

          close: async () => {
            this.openInstances -= 1; // decrement first in case of error

            if (this.repairRequested || this.currentPage?.repairRequested || (Date.now() - this.pageCreatedAt > maxAgeMs)) {
              await this.repair();
            }
          },
        };
      },

      close: async () => {},

      repair: async () => {
        console.log('Repair requested');
        this.repairRequested = true;
        await this.repair();
      },
    };
  }
}
