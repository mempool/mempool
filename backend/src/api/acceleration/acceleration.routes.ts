import { Application, Request, Response } from 'express';
import config from '../../config';
import axios from 'axios';
import logger from '../../logger';
import mempool from '../mempool';
import AccelerationRepository from '../../repositories/AccelerationRepository';

class AccelerationRoutes {
  private tag = 'Accelerator';

  public initRoutes(app: Application): void {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'services/accelerator/accelerations', this.$getAcceleratorAccelerations.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'services/accelerator/accelerations/history', this.$getAcceleratorAccelerationsHistory.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'services/accelerator/accelerations/history/aggregated', this.$getAcceleratorAccelerationsHistoryAggregated.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'services/accelerator/accelerations/stats', this.$getAcceleratorAccelerationsStats.bind(this))
      .post(config.MEMPOOL.API_URL_PREFIX + 'services/accelerator/estimate', this.$getAcceleratorEstimate.bind(this))
    ;
  }

  private async $getAcceleratorAccelerations(req: Request, res: Response): Promise<void> {
    const accelerations = mempool.getAccelerations();
    res.status(200).send(Object.values(accelerations));
  }

  private async $getAcceleratorAccelerationsHistory(req: Request, res: Response): Promise<void> {
    const history = await AccelerationRepository.$getAccelerationInfo(null, req.query.blockHeight ? parseInt(req.query.blockHeight as string, 10) : null);
    res.status(200).send(history.map(accel => ({
      txid: accel.txid,
      added: accel.added,
      status: 'completed',
      effectiveFee: accel.effective_fee,
      effectiveVsize: accel.effective_vsize,
      boostRate: accel.boost_rate,
      boostCost: accel.boost_cost,
      blockHeight: accel.height,
      pools: [accel.pool],
    })));
  }

  private async $getAcceleratorAccelerationsHistoryAggregated(req: Request, res: Response): Promise<void> {
    const url = `${config.MEMPOOL_SERVICES.API}/${req.originalUrl.replace('/api/v1/services/', '')}`;
    try {
      const response = await axios.get(url, { responseType: 'stream', timeout: 10000 });
      for (const key in response.headers) {
        res.setHeader(key, response.headers[key]);
      }
      response.data.pipe(res);
    } catch (e) {
      logger.err(`Unable to get aggregated acceleration history from ${url} in $getAcceleratorAccelerationsHistoryAggregated(), ${e}`, this.tag);
      res.status(500).end();
    }
  }

  private async $getAcceleratorAccelerationsStats(req: Request, res: Response): Promise<void> {
    const url = `${config.MEMPOOL_SERVICES.API}/${req.originalUrl.replace('/api/v1/services/', '')}`;
    try {
      const response = await axios.get(url, { responseType: 'stream', timeout: 10000 });
      for (const key in response.headers) {
        res.setHeader(key, response.headers[key]);
      }
      response.data.pipe(res);
    } catch (e) {
      logger.err(`Unable to get acceleration stats from ${url} in $getAcceleratorAccelerationsStats(), ${e}`, this.tag);
      res.status(500).end();
    }
  }

  private async $getAcceleratorEstimate(req: Request, res: Response): Promise<void> {
    const url = `${config.MEMPOOL_SERVICES.API}/${req.originalUrl.replace('/api/v1/services/', '')}`;
    try {
      const response = await axios.post(url, req.body, { responseType: 'stream', timeout: 10000 });
      for (const key in response.headers) {
        res.setHeader(key, response.headers[key]);
      }
      response.data.pipe(res);
    } catch (e) {
      logger.err(`Unable to get acceleration estimate from ${url} in $getAcceleratorEstimate(), ${e}`, this.tag);
      res.status(500).end();
    }
  }
}

export default new AccelerationRoutes();