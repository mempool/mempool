import config from '../../config';
import { Application, Request, Response } from 'express';
import nodesApi from './nodes.api';
import channelsApi from './channels.api';
import statisticsApi from './statistics.api';
class GeneralLightningRoutes {
  constructor() { }

  public initRoutes(app: Application) {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/search', this.$searchNodesAndChannels)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/statistics/latest', this.$getGeneralStats)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/statistics', this.$getStatistics)
    ;
  }

  private async $searchNodesAndChannels(req: Request, res: Response) {
    if (typeof req.query.searchText !== 'string') {
      res.status(501).send('Missing parameter: searchText');
      return;
    }
    try {
      const nodes = await nodesApi.$searchNodeByPublicKeyOrAlias(req.query.searchText);
      const channels = await channelsApi.$searchChannelsById(req.query.searchText);
      res.json({
        nodes: nodes,
        channels: channels,
      });
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getStatistics(req: Request, res: Response) {
    try {
      const statistics = await statisticsApi.$getStatistics();
      res.json(statistics);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getGeneralStats(req: Request, res: Response) {
    try {
      const statistics = await statisticsApi.$getLatestStatistics();
      res.json(statistics);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }
}

export default new GeneralLightningRoutes();
