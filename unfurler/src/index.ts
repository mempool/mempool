import express from "express";
import { Application, Request, Response, NextFunction } from 'express';
import * as http from 'http';
import * as https from 'https';
import config from './config';
import { Cluster } from 'puppeteer-cluster';
import ReusablePage from './concurrency/ReusablePage';
import ReusableSSRPage from './concurrency/ReusableSSRPage';
import { parseLanguageUrl } from './language/lang';
import { matchRoute, networks } from './routes';
import nodejsPath from 'path';
import logger from './logger';
import { TimeoutError } from "puppeteer";
import * as fs from 'fs';
import * as path from 'path';
const puppeteerConfig = require('../puppeteer.config.json');

if (config.PUPPETEER.EXEC_PATH) {
  puppeteerConfig.executablePath = config.PUPPETEER.EXEC_PATH;
}

const puppeteerEnabled = config.PUPPETEER.ENABLED && (config.PUPPETEER.CLUSTER_SIZE > 0);

class Server {
  private server: http.Server | undefined;
  private app: Application;
  cluster?: Cluster;
  ssrCluster?: Cluster;
  mempoolHost: string;
  mempoolUrl: URL;
  network: string;
  secureHost = true;
  secureMempoolHost = true;
  canonicalHost: string;
  networkName: string;
  protocol: string;

  customConfigs: Record<string, {
    canonicalHost: string;
    networkName: string;
    title: string;
    description: string;
    previewFallbackImg: string;
  }> = {}; // hostname -> config
  legacyDomains: string[] = [];
  refreshingConfigs: boolean = false;

  seoQueueLength: number = 0;
  unfurlQueueLength: number = 0;

  constructor() {
    this.app = express();
    this.mempoolHost = config.MEMPOOL.HTTP_HOST + (config.MEMPOOL.HTTP_PORT ? ':' + config.MEMPOOL.HTTP_PORT : '');
    this.mempoolUrl = new URL(this.mempoolHost);
    this.secureHost = config.SERVER.HOST.startsWith('https');
    this.secureMempoolHost = config.MEMPOOL.HTTP_HOST.startsWith('https');
    this.protocol = this.secureHost ? 'https://' : 'http://';
    this.network = config.MEMPOOL.NETWORK || 'bitcoin';
    this.networkName = networks[this.network].networkName || capitalize(this.network);

    this.loadEnterpriseConfigs();

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

    setInterval(async () => {
      await this.refreshEnterpriseConfigs();
    }, 600_000);
    this.refreshEnterpriseConfigs();

    setTimeout(async () => {
      logger.info(`killing myself now`);
      await this.stopServer();
      process.exit(0);
    }, 3600_000 * (1 + Math.random()))
  }

  loadEnterpriseConfigs() {
    if (config.ENTERPRISE.ENABLED) {
      // Load cached custom configs from customConfig.json (if it exists)
      const customConfigPath = './customConfig.json';
      if (fs.existsSync(customConfigPath)) {
        logger.info(`Loading cached custom configs from ${customConfigPath}`);
        try {
          const cachedConfig = JSON.parse(fs.readFileSync(customConfigPath, 'utf8'));
          this.customConfigs = cachedConfig;
        } catch (e) {
          logger.err(`Failed to load cached custom config: ${e instanceof Error ? e.message : e}`);
        }
      }

      // Load legacy custom config files from frontend directory
      const frontendConfigPath = '../frontend';
      if (fs.existsSync(frontendConfigPath)) {
        const files = fs.readdirSync(frontendConfigPath);
        for (const file of files) {
          const match = file.match(/^custom-(.*)-config\.json$/);
          if (match) {
            const key = match[1];
            try {
              const configContent = JSON.parse(fs.readFileSync(path.join(frontendConfigPath, file), 'utf8'));
              for (const hostname of configContent.domains) {
                this.customConfigs[hostname] = {
                  canonicalHost: hostname,
                  networkName: capitalize(configContent.enterprise),
                  title: configContent.meta?.title || configContent.branding?.title,
                  description: configContent.meta?.description || configContent.dashboard?.description,
                  previewFallbackImg: configContent.meta?.previewFallbackImg || `/resources/${configContent.enterprise}/${configContent.enterprise}-preview.jpg`,
                }
                this.legacyDomains.push(hostname);
              }
            } catch (e) {
              logger.err(`Failed to load custom config for ${key}: ${e instanceof Error ? e.message : e}`);
            }
          }
        }
      }
    }
  }

  async refreshEnterpriseConfigs() {
    if (!config.ENTERPRISE.ENABLED || this.refreshingConfigs) {
      return;
    }
    this.refreshingConfigs = true;
    logger.info('refreshing enterprise configs');

    try {
      // Fetch list of active enterprises
      const listResponse = await fetch(`${config.API.SERVICES}/internal/enterprise/dashboard/list`, {
        headers: { 'user-agent': 'mempoolunfurl' }
      });
      if (!listResponse.ok) {
        throw new Error(`Failed to fetch enterprise list: ${listResponse.statusText}`);
      }
      const enterprises = await listResponse.json();

      // Track all active domains
      const activeDomains = new Set<string>();

      // Fetch and process each enterprise config
      for (const enterprise of enterprises) {
        const configResponse = await fetch(`${config.API.SERVICES}/internal/enterprise/dashboard/${enterprise}`, {
          headers: { 'user-agent': 'mempoolunfurl' }
        });
        if (!configResponse.ok) {
          logger.err(`Failed to fetch config for enterprise ${enterprise}: ${configResponse.statusText}`);
          continue;
        }
        const configContent = await configResponse.json();

        // Process each domain in the enterprise config
        for (const hostname of configContent.domains) {
          activeDomains.add(hostname);
          
          this.customConfigs[hostname] = {
            canonicalHost: hostname,
            networkName: capitalize(configContent.enterprise),
            title: configContent.meta?.title || configContent.branding?.title,
            description: configContent.meta?.description || configContent.dashboard?.description,
            previewFallbackImg: configContent.meta?.previewFallbackImg,
          };
        }
      }

      // Remove any configs that are no longer active
      for (const domain of this.legacyDomains) {
        activeDomains.add(domain);
      }
      for (const hostname of Object.keys(this.customConfigs)) {
        if (!activeDomains.has(hostname)) {
          delete this.customConfigs[hostname];
        }
      }

      // Create a filtered version of customConfigs without legacy domains for caching
      const cacheConfigs = { ...this.customConfigs };
      for (const legacyDomain of this.legacyDomains) {
        delete cacheConfigs[legacyDomain];
      }

      // Save updated configs to file (excluding legacy domains)
      const customConfigPath = './customConfig.json';
      logger.info(`Saving updated configs to ${customConfigPath}`);
      await fs.promises.writeFile(customConfigPath, JSON.stringify(cacheConfigs, null, 2), 'utf8');

      logger.info(`Successfully refreshed enterprise configs. Active domains: ${Array.from(activeDomains).join(', ')}`);
    } catch (e) {
      logger.err(`Failed to refresh enterprise configs: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.refreshingConfigs = false;
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

    if (puppeteerEnabled) {
      this.cluster = await Cluster.launch({
          concurrency: ReusablePage,
          maxConcurrency: config.PUPPETEER.CLUSTER_SIZE,
          puppeteerOptions: puppeteerConfig,
      });
      await this.cluster?.task(async (args) => { return this.clusterTask(args) });
      this.ssrCluster = await Cluster.launch({
        concurrency: ReusableSSRPage,
        maxConcurrency: config.PUPPETEER.CLUSTER_SIZE,
        puppeteerOptions: puppeteerConfig,
      });
      await this.ssrCluster?.task(async (args) => { return this.ssrClusterTask(args) });
    }

    this.setUpRoutes();

    this.server = http.createServer(this.app);

    this.server.listen(config.SERVER.HTTP_PORT, () => {
      logger.info(`Mempool Unfurl Server is running on port ${config.SERVER.HTTP_PORT}`);
    });
  }

  async stopServer() {
    if (this.cluster) {
      await this.cluster.idle();
      await this.cluster.close();
    }
    if (this.ssrCluster) {
      await this.ssrCluster.idle();
      await this.ssrCluster.close();
    }
    if (this.server) {
      await this.server.close();
    }
  }

  setUpRoutes() {
    this.app.set('view engine', 'ejs');

    if (puppeteerEnabled) {
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

  async clusterTask({ page, data: { host, url, path, action, reqUrl } }) {
    const start = Date.now();
    try {
      logger.info(`rendering "${reqUrl}" on tab ${page.clusterGroup}:${page.index} for host ${host}`);
      const urlParts = parseLanguageUrl(path);
      if (page.language !== urlParts.lang || host !== page.host) {
        // switch language
        page.language = urlParts.lang;
        page.host = host;
        const localizedUrl = urlParts.lang ? `${host}/${urlParts.lang}${urlParts.path}` : `${host}${urlParts.path}` ;
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
      let success;
      await page.waitForSelector('meta[property="og:preview:loading"]', { timeout: config.PUPPETEER.RENDER_TIMEOUT || 3000 })
      success = await Promise.race([
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
        logger.warn(`failed to render ${reqUrl} for ${action} due to client-side error, e.g. requested an invalid txid`);
        page.repairRequested = true;
      } else {
        logger.warn(`failed to render ${reqUrl} for ${action} due to puppeteer timeout`);
        page.repairRequested = true;
      }
    } catch (e) {
      logger.err(`failed to render ${reqUrl} for ${action}: ` + (e instanceof Error ? e.message : `${e}`));
      page.repairRequested = true;
    }
  }

  async ssrClusterTask({ page, data: { host, url, path, action, reqUrl } }) {
    const start = Date.now();
    try {
      logger.info(`slurping "${reqUrl}" on tab ${page.clusterGroup}:${page.index}`);
      const urlParts = parseLanguageUrl(path);
      if (page.language !== urlParts.lang || host !== page.host) {
        // switch language
        page.language = urlParts.lang;
        page.host = host;
        const localizedUrl = urlParts.lang ? `${host}/${urlParts.lang}${urlParts.path}` : `${host}${urlParts.path}`;
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
        let html = await page.content();
        logger.info(`rendered slurp in ${Date.now() - start}ms for "${reqUrl}" on tab ${page.clusterGroup}:${page.index}`);
        return html;
      }
    } catch (e) {
      if (e instanceof TimeoutError) {
        let html = await page.content();
        logger.info(`rendered partial slurp in ${Date.now() - start}ms for "${reqUrl}" on tab ${page.clusterGroup}:${page.index}`);
        return html;
      } else {
        logger.err(`failed to render ${reqUrl} for ${action}: ` + (e instanceof Error ? e.message : `${e}`));
        page.repairRequested = true;
      }
    }
  }

  async renderDisabled(req, res) {
    res.status(500).send("preview rendering disabled");
  }

  async renderPreview(req, res) {
    try {
      this.unfurlQueueLength++;
      const start = Date.now();
      const rawPath = req.params[0];

      const host = config.ENTERPRISE.ENABLED ? req.hostname : this.mempoolHost;
      const hostPrefix = config.ENTERPRISE.ENABLED ? (this.secureHost ? 'https://' : 'http://') + req.hostname : this.mempoolHost;
      const customConfig = config.ENTERPRISE.ENABLED ? this.customConfigs[host] : null;

      let img = null;

      const { lang, path } = parseLanguageUrl(rawPath);
      const matchedRoute = matchRoute(this.network, path);

      // don't bother unless the route is definitely renderable
      if (rawPath.includes('/preview/') && matchedRoute.render) {
        img = await this.cluster?.execute({ host: hostPrefix, url: hostPrefix + rawPath, path: rawPath, action: 'screenshot', reqUrl: req.url });
        logger.info(`unfurl returned "${req.url}" in ${Date.now() - start}ms | ${this.unfurlQueueLength - 1} tasks in queue`);
      } else {
        logger.info('rendering not enabled for page "' + req.url + '"');
      }

      if (!img) {
        res.set('Cache-control', 'no-cache');
        if (customConfig) {
          // proxy fallback image from the services backend
          logger.info('proxying resource "' + req.url + '"');
          try {
            if (this.secureMempoolHost) {
              https.get(hostPrefix + customConfig.previewFallbackImg, { headers: { 'user-agent': 'mempoolunfurl' }}, (got) => {
                res.writeHead(got.statusCode, got.headers);
                return got.pipe(res);
              });
            } else {
              http.get(hostPrefix + customConfig.previewFallbackImg, { headers: { 'user-agent': 'mempoolunfurl' }}, (got) => {
                res.writeHead(got.statusCode, got.headers);
                return got.pipe(res);
              });
            }
            return;
          } catch (e) {
            logger.err(`failed to proxy resource "${req.url}": ` + (e instanceof Error ? e.message : `${e}`));
            res.status(500).send();
          }
        } else {
          // send local fallback image file
          res.sendFile(nodejsPath.join(__dirname, matchedRoute.fallbackImg));
        }
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
    logger.info('req: ' + req);

    const host = config.ENTERPRISE.ENABLED ? req.hostname : null;
    const hostPrefix = config.ENTERPRISE.ENABLED ? this.protocol + host : this.mempoolHost;

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
        try {
          if (this.secureMempoolHost) {
            https.get(hostPrefix + rawPath, { headers: { 'user-agent': 'mempoolunfurl' }}, (got) => {
              res.writeHead(got.statusCode, got.headers);
              return got.pipe(res);
            });
          } else {
            http.get(hostPrefix + rawPath, { headers: { 'user-agent': 'mempoolunfurl' }}, (got) => {
              res.writeHead(got.statusCode, got.headers);
              return got.pipe(res);
            });
          }
          return;
        } catch (e) {
          logger.err(`failed to proxy resource "${req.url}": ` + (e instanceof Error ? e.message : `${e}`));
          res.status(500).send();
        }
      }
    }

    let result = '';
    try {
      if (unfurl) {
        logger.info('unfurling "' + req.url + '"');
        result = await this.renderUnfurlMeta(host, rawPath);
      } else {
        this.seoQueueLength++;
        const start = Date.now();
        result = await this.renderSEOPage(hostPrefix, rawPath, req.url);
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

  async renderUnfurlMeta(host: string, rawPath: string): Promise<string> {
    const customConfig = config.ENTERPRISE.ENABLED ? this.customConfigs[host] : null;

    const { lang, path } = parseLanguageUrl(rawPath);
    const matchedRoute = matchRoute(this.network, path);

    let ogImageUrl = config.SERVER.HOST + (matchedRoute.staticImg || matchedRoute.fallbackImg);
    let ogTitle = 'The Mempool Open Source Project®';
    let ogDescription = 'Explore the full Bitcoin ecosystem with mempool.space';
    let hostPrefix = config.SERVER.HOST;
    let canonicalHost = this.canonicalHost;
    let networkName = this.networkName;

    if (config.ENTERPRISE.ENABLED && customConfig) {
      hostPrefix = this.protocol + host;
      ogImageUrl = hostPrefix + customConfig.previewFallbackImg;
      ogTitle = customConfig.title;
      ogDescription = customConfig.description;
      canonicalHost = customConfig.canonicalHost;
      networkName = customConfig.networkName;
    }

    const canonical = canonicalHost + rawPath;

    if (matchedRoute.render) {
      ogImageUrl = `${hostPrefix}/render/${lang || 'en'}/preview${path}`;
      ogTitle = `${networkName} ${matchedRoute.networkMode !== 'mainnet' ? capitalize(matchedRoute.networkMode) + ' ' : ''}${matchedRoute.title || ogTitle}`;
    } else {
      ogTitle = networks[this.network].title || ogTitle;
    }
    if (matchedRoute.description) {
      ogDescription = matchedRoute.description || ogDescription;
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

  async renderSEOPage(host: string, rawPath: string, reqUrl: string): Promise<string> {
    let canonicalHost = this.canonicalHost;
    const customConfig = config.ENTERPRISE.ENABLED ? this.customConfigs[host] : null;
    if (customConfig) {
      canonicalHost = customConfig.canonicalHost;
    }

    let html = await this.ssrCluster?.execute({ host, url: host + rawPath, path: rawPath, action: 'ssr', reqUrl });
    // remove javascript to prevent double hydration
    if (html && html.length) {
      html = html.replaceAll(/<script.*<\/script>/g, "");
      html = html.replaceAll(host, canonicalHost);
    }
    return html;
  }

  async renderSip(req, res): Promise<void> {
    const start = Date.now();
    const rawPath = req.params[0];
    const { lang, path } = parseLanguageUrl(rawPath);
    const matchedRoute = matchRoute(this.network, path, 'sip');

    const host = config.ENTERPRISE.ENABLED ? req.hostname : this.mempoolHost;
    const customConfig = config.ENTERPRISE.ENABLED ? this.customConfigs[host] : null;


    let ogImageUrl = config.SERVER.HOST + (matchedRoute.staticImg || matchedRoute.fallbackImg);
    let ogTitle = 'The Mempool Open Source Project®';
    let hostPrefix = config.SERVER.HOST;
    let canonicalHost = this.canonicalHost;
    let networkName = this.networkName;

    if (config.ENTERPRISE.ENABLED && customConfig) {
      hostPrefix = this.protocol + host;
      ogImageUrl = hostPrefix + customConfig.previewFallbackImg;
      ogTitle = customConfig.title;
      canonicalHost = customConfig.canonicalHost;
      networkName = customConfig.networkName;
    }

    const canonical = canonicalHost + rawPath;

    if (matchedRoute.render) {
      ogImageUrl = `${hostPrefix}/render/${lang || 'en'}/preview${path}`;
      ogTitle = `${networkName} ${matchedRoute.networkMode !== 'mainnet' ? capitalize(matchedRoute.networkMode) + ' ' : ''}${matchedRoute.title || ogTitle}`;
    }

    if (matchedRoute.sip) {
      logger.info(`sipping "${req.url}"`);
      try {
        const data = await matchedRoute.sip.getData(matchedRoute.params);
        logger.info(`sip data fetched for "${req.url}" in ${Date.now() - start}ms`);
        res.render(matchedRoute.sip.template, { canonicalHost, canonical, ogImageUrl, ogTitle, matchedRoute, data });
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
