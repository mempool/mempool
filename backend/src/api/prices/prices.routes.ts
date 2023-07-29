import { Application, Request, Response } from 'express';
import config from '../../config';
import pricesUpdater from '../../tasks/price-updater';

class PricesRoutes {
  public initRoutes(app: Application): void {
    app.get(config.MEMPOOL.API_URL_PREFIX + 'prices', this.$getCurrentPrices.bind(this));
  }

  private async $getCurrentPrices(req: Request, res: Response): Promise<void> {
    res.header('Pragma', 'public');
    res.header('Cache-control', 'public');
    res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());

    res.json(pricesUpdater.getLatestPrices());
  }
}

export default new PricesRoutes();
