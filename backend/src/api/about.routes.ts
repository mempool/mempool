import { Application } from 'express';
import config from '../config';
import axios from 'axios';
import logger from '../logger';

const PROXY_PATH_SEGMENT_REGEX = /^(?!\.{1,2}$)[^\p{Cc}/?#\\]{1,256}$/u;

class AboutRoutes {
  public initRoutes(app: Application) {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'donations', async (req, res) => {
        try {
          const response = await axios.get(`${config.EXTERNAL_DATA_SERVER.MEMPOOL_API}/donations`, { responseType: 'stream', timeout: 10000 });
          response.data.pipe(res);
        } catch (e) {
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'donations/images/:id', async (req, res) => {
        if (!PROXY_PATH_SEGMENT_REGEX.test(req.params.id)) {
          res.status(400).end();
          return;
        }

        try {
          const response = await axios.get(`${config.EXTERNAL_DATA_SERVER.MEMPOOL_API}/donations/images/${encodeURIComponent(req.params.id)}`, {
            responseType: 'stream', timeout: 10000
          });
          response.data.pipe(res);
        } catch (e) {
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'contributors', async (req, res) => {
        try {
          const response = await axios.get(`${config.EXTERNAL_DATA_SERVER.MEMPOOL_API}/contributors`, { responseType: 'stream', timeout: 10000 });
          response.data.pipe(res);
        } catch (e) {
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'contributors/images/:id', async (req, res) => {
        if (!PROXY_PATH_SEGMENT_REGEX.test(req.params.id)) {
          res.status(400).end();
          return;
        }

        try {
          const response = await axios.get(`${config.EXTERNAL_DATA_SERVER.MEMPOOL_API}/contributors/images/${encodeURIComponent(req.params.id)}`, {
            responseType: 'stream', timeout: 10000
          });
          response.data.pipe(res);
        } catch (e) {
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'translators', async (req, res) => {
        try {
          const response = await axios.get(`${config.EXTERNAL_DATA_SERVER.MEMPOOL_API}/translators`, { responseType: 'stream', timeout: 10000 });
          response.data.pipe(res);
        } catch (e) {
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'translators/images/:id', async (req, res) => {
        if (!PROXY_PATH_SEGMENT_REGEX.test(req.params.id)) {
          res.status(400).end();
          return;
        }

        try {
          const response = await axios.get(`${config.EXTERNAL_DATA_SERVER.MEMPOOL_API}/translators/images/${encodeURIComponent(req.params.id)}`, {
            responseType: 'stream', timeout: 10000
          });
          response.data.pipe(res);
        } catch (e) {
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'services/sponsors', async (req, res) => {
        const url = `${config.MEMPOOL_SERVICES.API}/sponsors`;
        try {
          const response = await axios.get(url, { responseType: 'stream', timeout: 10000 });
          response.data.pipe(res);
        } catch (e) {
          logger.err(`Unable to fetch sponsors from ${url}. ${e}`, 'About Page');
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'services/account/images/:username/:md5', async (req, res) => {
        if (!PROXY_PATH_SEGMENT_REGEX.test(req.params.username) || !PROXY_PATH_SEGMENT_REGEX.test(req.params.md5)) {
          res.status(400).end();
          return;
        }

        const url = `${config.MEMPOOL_SERVICES.API}/account/images/${encodeURIComponent(req.params.username)}/${encodeURIComponent(req.params.md5)}`;
        try {
          const response = await axios.get(url, { responseType: 'stream', timeout: 10000 });
          response.data.pipe(res);
        } catch (e) {
          logger.err(`Unable to fetch sponsor profile image from ${url}. ${e}`, 'About Page');
          res.status(500).end();
        }
      })
    ;
  }
}

export default new AboutRoutes();
