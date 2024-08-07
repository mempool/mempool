import { Application } from "express";
import config from "../config";
import axios from "axios";
import logger from "../logger";

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
        try {
          const response = await axios.get(`${config.EXTERNAL_DATA_SERVER.MEMPOOL_API}/donations/images/${req.params.id}`, {
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
        try {
          const response = await axios.get(`${config.EXTERNAL_DATA_SERVER.MEMPOOL_API}/contributors/images/${req.params.id}`, {
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
        try {
          const response = await axios.get(`${config.EXTERNAL_DATA_SERVER.MEMPOOL_API}/translators/images/${req.params.id}`, {
            responseType: 'stream', timeout: 10000
          });
          response.data.pipe(res);
        } catch (e) {
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'services/sponsors', async (req, res) => {
        const url = `${config.MEMPOOL_SERVICES.API}/${req.originalUrl.replace('/api/v1/services/', '')}`;
        try {
          const response = await axios.get(url, { responseType: 'stream', timeout: 10000 });
          response.data.pipe(res);
        } catch (e) {
          logger.err(`Unable to fetch sponsors from ${url}. ${e}`, 'About Page');
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'services/account/images/:username/:md5', async (req, res) => {
        const url = `${config.MEMPOOL_SERVICES.API}/${req.originalUrl.replace('/api/v1/services/', '')}`;
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