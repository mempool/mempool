import { Application, Request, Response } from 'express';
import config from '../../config';
import pricesUpdater from '../../tasks/price-updater';

class PricesRoutes {
  public initRoutes(app: Application): void {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'prices', this.$getCurrentPrices.bind(this))
    ;
  }

  private $getCurrentPrices(req: Request, res: Response): void {
    res.header('Pragma', 'public');
    res.header('Cache-control', 'public');
    res.setHeader('Expires', new Date(Date.now() + 360_0000 / config.MEMPOOL.PRICE_UPDATES_PER_HOUR).toUTCString());

    res.json(pricesUpdater.getLatestPrices());
  }
}

export default new PricesRoutes();
