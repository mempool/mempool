import axios from 'axios';
import { Application, Request, Response } from 'express';
import config from '../../config';
import elementsParser from './elements-parser';
import icons from './icons';

class LiquidRoutes {
  public initRoutes(app: Application) {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'assets/icons', this.getAllLiquidIcon)
      .get(config.MEMPOOL.API_URL_PREFIX + 'assets/featured', this.$getAllFeaturedLiquidAssets)
      .get(config.MEMPOOL.API_URL_PREFIX + 'asset/:assetId/icon', this.getLiquidIcon)
      .get(config.MEMPOOL.API_URL_PREFIX + 'assets/group/:id', this.$getAssetGroup)
      ;
    
    if (config.DATABASE.ENABLED) {
      app
        .get(config.MEMPOOL.API_URL_PREFIX + 'liquid/pegs/month', this.$getElementsPegsByMonth)
        ;
    }
  }


  private getLiquidIcon(req: Request, res: Response) {
    const result = icons.getIconByAssetId(req.params.assetId);
    if (result) {
      res.setHeader('content-type', 'image/png');
      res.setHeader('content-length', result.length);
      res.send(result);
    } else {
      res.status(404).send('Asset icon not found');
    }
  }

  private getAllLiquidIcon(req: Request, res: Response) {
    const result = icons.getAllIconIds();
    if (result) {
      res.json(result);
    } else {
      res.status(404).send('Asset icons not found');
    }
  }

  private async $getAllFeaturedLiquidAssets(req: Request, res: Response) {
    try {
      const response = await axios.get(`${config.EXTERNAL_DATA_SERVER.LIQUID_API}/assets/featured`, { responseType: 'stream', timeout: 10000 });
      response.data.pipe(res);
    } catch (e) {
      res.status(500).end();
    }
  }

  private async $getAssetGroup(req: Request, res: Response) {
    try {
      const response = await axios.get(`${config.EXTERNAL_DATA_SERVER.LIQUID_API}/assets/group/${parseInt(req.params.id, 10)}`,
        { responseType: 'stream', timeout: 10000 });
      response.data.pipe(res);
    } catch (e) {
      res.status(500).end();
    }
  }

  private async $getElementsPegsByMonth(req: Request, res: Response) {
    try {
      const pegs = await elementsParser.$getPegDataByMonth();
      res.json(pegs);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }
}

export default new LiquidRoutes();
