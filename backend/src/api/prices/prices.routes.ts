import { Application, Request, Response } from 'express';
import config from '../../config';
import pricesUpdater from '../../tasks/price-updater';
import logger from '../../logger';
import PricesRepository from '../../repositories/PricesRepository';

class PricesRoutes {
  public initRoutes(app: Application): void {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'prices', this.$getCurrentPrices.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'internal/usd-price-history', this.$getAllPrices.bind(this))
    ;
  }

  private $getCurrentPrices(req: Request, res: Response): void {
    res.header('Pragma', 'public');
    res.header('Cache-control', 'public');
    res.setHeader('Expires', new Date(Date.now() + 360_0000 / config.MEMPOOL.PRICE_UPDATES_PER_HOUR).toUTCString());

    res.json(pricesUpdater.getLatestPrices());
  }

  private async $getAllPrices(req: Request, res: Response): Promise<void> {
    res.header('Pragma', 'public');
    res.header('Cache-control', 'public');
    res.setHeader('Expires', new Date(Date.now() + 360_0000 / config.MEMPOOL.PRICE_UPDATES_PER_HOUR).toUTCString());

    try {
      const usdPriceHistory = await PricesRepository.$getPricesTimesAndId();
      const responseData = usdPriceHistory.map(p => {
        return { time: p.time, USD: p.USD };
      });
      res.status(200).json(responseData);
    } catch (e: any) {
      logger.err(`Exception ${e} in PricesRoutes::$getAllPrices. Code: ${e.code}. Message: ${e.message}`);
      res.status(403).send();
    }
  }
}

export default new PricesRoutes();
