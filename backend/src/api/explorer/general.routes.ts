import config from '../../config';
import { Application, Request, Response } from 'express';
import nodesApi from './nodes.api';
import channelsApi from './channels.api';
import statisticsApi from './statistics.api';
import { handleError } from '../../utils/api';

class GeneralLightningRoutes {
  constructor() { }

  public initRoutes(app: Application) {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/search', this.$searchNodesAndChannels)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/statistics/latest', this.$getGeneralStats)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/statistics/:interval', this.$getStatistics)
    ;
  }

  private async $searchNodesAndChannels(req: Request, res: Response) {
    if (typeof req.query.searchText !== 'string') {
      res.status(400).send('Missing parameter: searchText');
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
      handleError(req, res, 500, 'Failed to search for nodes and channels');
    }
  }

  private async $getStatistics(req: Request, res: Response) {
    try {
      const statistics = await statisticsApi.$getStatistics(req.params.interval);
      const statisticsCount = await statisticsApi.$getStatisticsCount();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', statisticsCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(statistics);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get lightning statistics');
    }
  }

  private async $getGeneralStats(req: Request, res: Response) {
    try {
      const statistics = await statisticsApi.$getLatestStatistics();
      res.json(statistics);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get lightning statistics');
    }
  }
}

export default new GeneralLightningRoutes();
