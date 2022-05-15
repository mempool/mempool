import config from '../../config';
import { Express, Request, Response } from 'express';
import channelsApi from './channels.api';

class ChannelsRoutes {
  constructor() { }

  public initRoutes(app: Express) {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'channels/txids', this.$getChannelsByTransactionIds)
      .get(config.MEMPOOL.API_URL_PREFIX + 'channels/search/:search', this.$searchChannelsById)
      .get(config.MEMPOOL.API_URL_PREFIX + 'channels/:short_id', this.$getChannel)
      .get(config.MEMPOOL.API_URL_PREFIX + 'channels', this.$getChannelsForNode)
    ;
  }

  private async $searchChannelsById(req: Request, res: Response) {
    try {
      const channels = await channelsApi.$searchChannelsById(req.params.search);
      res.json(channels);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getChannel(req: Request, res: Response) {
    try {
      const channel = await channelsApi.$getChannel(req.params.short_id);
      if (!channel) {
        res.status(404).send('Channel not found');
        return;
      }
      res.json(channel);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getChannelsForNode(req: Request, res: Response) {
    try {
      if (typeof req.query.public_key !== 'string') {
        res.status(501).send('Missing parameter: public_key');
        return;
      }
      const index = parseInt(typeof req.query.index === 'string' ? req.query.index : '0', 10) || 0;
      const status: string = typeof req.query.status === 'string' ? req.query.status : '';
      const length = 25;
      const channels = await channelsApi.$getChannelsForNode(req.query.public_key, index, length, status);
      const channelsCount = await channelsApi.$getChannelsCountForNode(req.query.public_key, status);
      res.header('X-Total-Count', channelsCount.toString());
      res.json(channels);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getChannelsByTransactionIds(req: Request, res: Response) {
    try {
      if (!Array.isArray(req.query.txId)) {
        res.status(500).send('Not an array');
        return;
      }
      const txIds: string[] = [];
      for (const _txId in req.query.txId) {
        if (typeof req.query.txId[_txId] === 'string') {
          txIds.push(req.query.txId[_txId].toString());
        }
      }
      const channels = await channelsApi.$getChannelsByTransactionId(txIds);
      const result: any[] = [];
      for (const txid of txIds) {
        const foundChannel = channels.find((channel) => channel.transaction_id === txid);
        if (foundChannel) {
          result.push(foundChannel);
        } else {
          result.push(null);
        }
      }

      res.json(result);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

}

export default new ChannelsRoutes();
