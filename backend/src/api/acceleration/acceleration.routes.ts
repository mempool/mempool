import { Application, Request, Response } from "express";
import config from "../../config";
import axios from "axios";
import logger from "../../logger";

class AccelerationRoutes {
  private tag = 'Accelerator';

  public initRoutes(app: Application) {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'services/accelerator/accelerations', this.$getAcceleratorAccelerations.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'services/accelerator/accelerations/history', this.$getAcceleratorAccelerationsHistory.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'services/accelerator/accelerations/history/aggregated', this.$getAcceleratorAccelerationsHistoryAggregated.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'services/accelerator/accelerations/stats', this.$getAcceleratorAccelerationsStats.bind(this))
    ;
  }

  private async $getAcceleratorAccelerations(req: Request, res: Response) {
    const url = `https://mempool.space${req.originalUrl}`;
    try {
      const response = await axios.get(url, { responseType: 'stream', timeout: 10000 });
      response.data.pipe(res);
    } catch (e) {
      logger.err(`Unable to get current accelerations from ${url} in $getAcceleratorAccelerations(), ${e}`, this.tag);
      res.status(500).end();
    }
  }

  private async $getAcceleratorAccelerationsHistory(req: Request, res: Response) {
    const url = `https://mempool.space${req.originalUrl}`;
    try {
      const response = await axios.get(url, { responseType: 'stream', timeout: 10000 });
      response.data.pipe(res);
    } catch (e) {
      logger.err(`Unable to get acceleration history from ${url} in $getAcceleratorAccelerationsHistory(), ${e}`, this.tag);
      res.status(500).end();
    }
  }

  private async $getAcceleratorAccelerationsHistoryAggregated(req: Request, res: Response) {
    const url = `https://mempool.space${req.originalUrl}`;
    try {
      const response = await axios.get(url, { responseType: 'stream', timeout: 10000 });
      response.data.pipe(res);
    } catch (e) {
      logger.err(`Unable to get aggregated acceleration history from ${url} in $getAcceleratorAccelerationsHistoryAggregated(), ${e}`, this.tag);
      res.status(500).end();
    }
  }

  private async $getAcceleratorAccelerationsStats(req: Request, res: Response) {
    const url = `https://mempool.space${req.originalUrl}`;
    try {
      const response = await axios.get(url, { responseType: 'stream', timeout: 10000 });
      response.data.pipe(res);
    } catch (e) {
      logger.err(`Unable to get acceleration stats from ${url} in $getAcceleratorAccelerationsStats(), ${e}`, this.tag);
      res.status(500).end();
    }
  }
}

export default new AccelerationRoutes();