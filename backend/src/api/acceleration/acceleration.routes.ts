import { Application, Request, Response } from 'express';
import config from '../../config';
import axios from 'axios';
import logger from '../../logger';
import mempool from '../mempool';
import AccelerationRepository, { PublicAcceleration } from '../../repositories/AccelerationRepository';
import { Acceleration } from '../services/acceleration';

interface ApiAcceleration {
  txid: string,
  added: number,
  status: 'completed' | 'requested' | 'accelerating' | 'failed',
  effectiveFee: number,
  effectiveVsize: number,
  boostRate: number,
  boostCost: number,
  blockHeight: number | null,
  pools: number[],
  minedByPoolUniqueId?: number;
}

function mempoolAccelerationToApiAcceleration(mempoolAcceleration: Acceleration): ApiAcceleration {
  return {
    txid: mempoolAcceleration.txid,
    added: mempoolAcceleration.added,
    status: 'accelerating',
    effectiveFee: mempoolAcceleration.effectiveFee,
    effectiveVsize: mempoolAcceleration.effectiveVsize,
    boostRate: (mempoolAcceleration.effectiveFee + mempoolAcceleration.feeDelta) / mempoolAcceleration.effectiveVsize,
    boostCost: mempoolAcceleration.feeDelta,
    blockHeight: null,
    pools: mempoolAcceleration.pools,
  };
}

function savedAccelerationToApiAcceleration(savedAcceleration: PublicAcceleration): ApiAcceleration {
  return {
    txid: savedAcceleration.txid,
    added: savedAcceleration.added,
    status: 'completed',
    effectiveFee: savedAcceleration.effective_fee,
    effectiveVsize: savedAcceleration.effective_vsize,
    boostRate: savedAcceleration.boost_rate,
    boostCost: savedAcceleration.boost_cost,
    blockHeight: savedAcceleration.height,
    pools: [savedAcceleration.pool.id],
    minedByPoolUniqueId: savedAcceleration.pool.id,
  };
}

class AccelerationRoutes {
  private tag = 'Accelerator';

  public initRoutes(app: Application): void {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'services/accelerator/accelerations', this.$getAcceleratorAccelerations.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'services/accelerator/accelerations/history', this.$getAcceleratorAccelerationsHistory.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'services/accelerator/accelerations/history/aggregated', this.$getAcceleratorAccelerationsHistoryAggregated.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'services/accelerator/accelerations/stats', this.$getAcceleratorAccelerationsStats.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'services/accelerator/accelerations/:txid', this.$getAcceleratorAcceleration.bind(this))
      .post(config.MEMPOOL.API_URL_PREFIX + 'services/accelerator/estimate', this.$getAcceleratorEstimate.bind(this))
      .post(config.MEMPOOL.API_URL_PREFIX + 'services/accelerator/accelerate', this.$accelerate.bind(this))
    ;
  }

  private async $getAcceleratorAccelerations(req: Request, res: Response): Promise<void> {
    const accelerations = mempool.getAccelerations();
    res.status(200).send(Object.values(accelerations));
  }

  private async $getAcceleratorAcceleration(req: Request, res: Response): Promise<void> {
    let acceleration: ApiAcceleration | null = null;
    if (req.params.txid) {
      const mempoolAcceleration = mempool.getAccelerations()[req.params.txid];
      if (mempoolAcceleration) {
        acceleration = mempoolAccelerationToApiAcceleration(mempoolAcceleration);
      } else {
        const savedAcceleration = await AccelerationRepository.$getAccelerationInfoForTxid(req.params.txid);
        if (savedAcceleration) {
          acceleration = savedAccelerationToApiAcceleration(savedAcceleration);
        }
      }
    }
    if (acceleration) {
      res.status(200).send(acceleration);
    } else {
      res.status(404).send('Acceleration not found');
    }
  }

  private async $getAcceleratorAccelerationsHistory(req: Request, res: Response): Promise<void> {
    const history = await AccelerationRepository.$getAccelerationInfo(null, req.query.blockHeight ? parseInt(req.query.blockHeight as string, 10) : null);
    res.status(200).send(history.map(savedAccelerationToApiAcceleration));
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
      const headers = {
        ...(req.headers['authorization'] && { authorization: req.headers['authorization'] }),
        ...(req.headers['cookie'] && { cookie: req.headers['cookie'] }),
        ...(req.headers['content-type'] && { 'content-type': req.headers['content-type'] }),
        ...(req.headers['accept'] && { accept: req.headers['accept'] }),
        ...(req.headers['accept-language'] && { 'accept-language': req.headers['accept-language'] }),
      };
      const response = await axios.post(url, req.body, { headers, responseType: 'stream', timeout: 10000 });
      for (const key in response.headers) {
        res.setHeader(key, response.headers[key]);
      }
      response.data.pipe(res);
    } catch (e) {
      logger.err(`Unable to get acceleration estimate from ${url} in $getAcceleratorEstimate(), ${e}`, this.tag);
      res.status(500).end();
    }
  }

  private async $accelerate(req: Request, res: Response): Promise<void> {
    const url = `${config.MEMPOOL_SERVICES.API}/${req.originalUrl.replace('/api/v1/services/', '')}`;
    try {
      const headers = {
        ...(req.headers['authorization'] && { authorization: req.headers['authorization'] }),
        ...(req.headers['cookie'] && { cookie: req.headers['cookie'] }),
        ...(req.headers['content-type'] && { 'content-type': req.headers['content-type'] }),
        ...(req.headers['accept'] && { accept: req.headers['accept'] }),
        ...(req.headers['accept-language'] && { 'accept-language': req.headers['accept-language'] }),
      };
      const response = await axios.post(url, req.body, { headers, responseType: 'stream', timeout: 10000 });
      for (const key in response.headers) {
        res.setHeader(key, response.headers[key]);
      }
      response.data.pipe(res);
    } catch (e) {
      logger.err(`Unable to accelerate transaction from ${url} in $accelerate(), ${e}`, this.tag);
      res.status(500).end();
    }
  }
}

export default new AccelerationRoutes();