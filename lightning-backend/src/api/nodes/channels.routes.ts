import config from '../../config';
import { Express, Request, Response } from 'express';
import channelsApi from './channels.api';

class ChannelsRoutes {
  constructor(app: Express) {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'channels/:public_key', this.$getChannels)
    ;
  }

  private async $getChannels(req: Request, res: Response) {
    try {
      const channels = await channelsApi.$getChannelsForNode(req.params.public_key);
      res.json(channels);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

}

export default ChannelsRoutes;
