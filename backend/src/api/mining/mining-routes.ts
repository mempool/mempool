import { Application, Request, Response } from 'express';
import config from "../../config";
import logger from '../../logger';
import BlocksAuditsRepository from '../../repositories/BlocksAuditsRepository';
import BlocksRepository from '../../repositories/BlocksRepository';
import DifficultyAdjustmentsRepository from '../../repositories/DifficultyAdjustmentsRepository';
import HashratesRepository from '../../repositories/HashratesRepository';
import bitcoinClient from '../bitcoin/bitcoin-client';
import mining from "./mining";

class MiningRoutes {
  public initRoutes(app: Application) {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pools/:interval', this.$getPools)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pool/:slug/hashrate', this.$getPoolHistoricalHashrate)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pool/:slug/blocks', this.$getPoolBlocks)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pool/:slug/blocks/:height', this.$getPoolBlocks)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pool/:slug', this.$getPool)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/hashrate/pools/:interval', this.$getPoolsHistoricalHashrate)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/hashrate/:interval', this.$getHistoricalHashrate)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/difficulty-adjustments', this.$getDifficultyAdjustments)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/reward-stats/:blockCount', this.$getRewardStats)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/fees/:interval', this.$getHistoricalBlockFees)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/rewards/:interval', this.$getHistoricalBlockRewards)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/fee-rates/:interval', this.$getHistoricalBlockFeeRates)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/sizes-weights/:interval', this.$getHistoricalBlockSizeAndWeight)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/difficulty-adjustments/:interval', this.$getDifficultyAdjustments)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/predictions/:interval', this.$getHistoricalBlockPrediction)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/audit/:hash', this.$getBlockAudit)
    ;
  }

  private async $getPool(req: Request, res: Response): Promise<void> {
    try {
      const stats = await mining.$getPoolStat(req.params.slug);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(stats);
    } catch (e) {
      if (e instanceof Error && e.message.indexOf('This mining pool does not exist') > -1) {
        res.status(404).send(e.message);
      } else {
        res.status(500).send(e instanceof Error ? e.message : e);
      }
    }
  }

  private async $getPoolBlocks(req: Request, res: Response) {
    try {
      const poolBlocks = await BlocksRepository.$getBlocksByPool(
        req.params.slug,
        req.params.height === undefined ? undefined : parseInt(req.params.height, 10),
      );
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(poolBlocks);
    } catch (e) {
      if (e instanceof Error && e.message.indexOf('This mining pool does not exist') > -1) {
        res.status(404).send(e.message);
      } else {
        res.status(500).send(e instanceof Error ? e.message : e);
      }
    }
  }

  private async $getPools(req: Request, res: Response) {
    try {
      const stats = await mining.$getPoolsStats(req.params.interval);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(stats);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getPoolsHistoricalHashrate(req: Request, res: Response) {
    try {
      const hashrates = await HashratesRepository.$getPoolsWeeklyHashrate(req.params.interval);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());
      res.json(hashrates);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getPoolHistoricalHashrate(req: Request, res: Response) {
    try {
      const hashrates = await HashratesRepository.$getPoolWeeklyHashrate(req.params.slug);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());
      res.json(hashrates);
    } catch (e) {
      if (e instanceof Error && e.message.indexOf('This mining pool does not exist') > -1) {
        res.status(404).send(e.message);
      } else {
        res.status(500).send(e instanceof Error ? e.message : e);
      }
    }
  }

  private async $getHistoricalHashrate(req: Request, res: Response) {
    let currentHashrate = 0, currentDifficulty = 0;
    try {
      currentHashrate = await bitcoinClient.getNetworkHashPs();
      currentDifficulty = await bitcoinClient.getDifficulty();
    } catch (e) {
      logger.debug('Bitcoin Core is not available, using zeroed value for current hashrate and difficulty');
    }

    try {
      const hashrates = await HashratesRepository.$getNetworkDailyHashrate(req.params.interval);
      const difficulty = await DifficultyAdjustmentsRepository.$getAdjustments(req.params.interval, false);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());
      res.json({
        hashrates: hashrates,
        difficulty: difficulty,
        currentHashrate: currentHashrate,
        currentDifficulty: currentDifficulty,
      });
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getHistoricalBlockFees(req: Request, res: Response) {
    try {
      const blockFees = await mining.$getHistoricalBlockFees(req.params.interval);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(blockFees);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getHistoricalBlockRewards(req: Request, res: Response) {
    try {
      const blockRewards = await mining.$getHistoricalBlockRewards(req.params.interval);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(blockRewards);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getHistoricalBlockFeeRates(req: Request, res: Response) {
    try {
      const blockFeeRates = await mining.$getHistoricalBlockFeeRates(req.params.interval);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(blockFeeRates);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getHistoricalBlockSizeAndWeight(req: Request, res: Response) {
    try {
      const blockSizes = await mining.$getHistoricalBlockSizes(req.params.interval);
      const blockWeights = await mining.$getHistoricalBlockWeights(req.params.interval);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json({
        sizes: blockSizes,
        weights: blockWeights
      });
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getDifficultyAdjustments(req: Request, res: Response) {
    try {
      const difficulty = await DifficultyAdjustmentsRepository.$getRawAdjustments(req.params.interval, true);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());
      res.json(difficulty.map(adj => [adj.time, adj.height, adj.difficulty, adj.adjustment]));
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getRewardStats(req: Request, res: Response) {
    try {
      const response = await mining.$getRewardStats(parseInt(req.params.blockCount, 10));
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(response);
    } catch (e) {
      res.status(500).end();
    }
  }

  private async $getHistoricalBlockPrediction(req: Request, res: Response) {
    try {
      const blockPredictions = await mining.$getBlockPredictionsHistory(req.params.interval);
      const blockCount = await BlocksAuditsRepository.$getPredictionsCount();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(blockPredictions.map(prediction => [prediction.time, prediction.height, prediction.match_rate]));
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async $getBlockAudit(req: Request, res: Response) {
    try {
      const audit = await BlocksAuditsRepository.$getBlockAudit(req.params.hash);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 3600 * 24).toUTCString());
      res.json(audit);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }
}

export default new MiningRoutes();
