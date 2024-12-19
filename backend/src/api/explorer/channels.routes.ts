import config from '../../config';
import { Application, Request, Response } from 'express';
import channelsApi from './channels.api';
import { handleError } from '../../utils/api';

const TXID_REGEX = /^[a-f0-9]{64}$/i;

class ChannelsRoutes {
  constructor() { }

  public initRoutes(app: Application) {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/channels/txids', this.$getChannelsByTransactionIds)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/channels/search/:search', this.$searchChannelsById)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/channels/:short_id', this.$getChannel)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/channels', this.$getChannelsForNode)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/penalties', this.$getPenaltyClosedChannels)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/channels-geo', this.$getAllChannelsGeo)
      .get(config.MEMPOOL.API_URL_PREFIX + 'lightning/channels-geo/:publicKey', this.$getAllChannelsGeo)
    ;
  }

  private async $searchChannelsById(req: Request, res: Response) {
    try {
      const channels = await channelsApi.$searchChannelsById(req.params.search);
      res.json(channels);
    } catch (e) {
      handleError(req, res, 500, 'Failed to search channels by id');
    }
  }

  private async $getChannel(req: Request, res: Response) {
    try {
      const channel = await channelsApi.$getChannel(req.params.short_id);
      if (!channel) {
        res.status(404).send('Channel not found');
        return;
      }
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(channel);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get channel');
    }
  }

  private async $getChannelsForNode(req: Request, res: Response) {
    try {
      if (typeof req.query.public_key !== 'string') {
        res.status(400).send('Missing parameter: public_key');
        return;
      }

      const index = parseInt(typeof req.query.index === 'string' ? req.query.index : '0', 10) || 0;
      const status: string = typeof req.query.status === 'string' ? req.query.status : '';

      if (index < -1) {
        handleError(req, res, 400, 'Invalid index');
        return;
      }
      if (['open', 'active', 'closed'].includes(status) === false) {
        handleError(req, res, 400, 'Invalid status');
        return;
      }

      const channels = await channelsApi.$getChannelsForNode(req.query.public_key, index, 10, status);
      const channelsCount = await channelsApi.$getChannelsCountForNode(req.query.public_key, status);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.header('X-Total-Count', channelsCount.toString());
      res.json(channels);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get channels for node');
    }
  }

  private async $getChannelsByTransactionIds(req: Request, res: Response): Promise<void> {
    try {
      if (!Array.isArray(req.query.txId)) {
        handleError(req, res, 400, 'Not an array');
        return;
      }
      const txIds: string[] = [];
      for (const _txId in req.query.txId) {
        if (typeof req.query.txId[_txId] === 'string') {
          const txid = req.query.txId[_txId].toString();
          if (TXID_REGEX.test(txid)) {
            txIds.push(txid);
          }
        }
      }
      const channels = await channelsApi.$getChannelsByTransactionId(txIds);
      const result: any[] = [];
      for (const txid of txIds) {
        const inputs: any = {};
        const outputs: any = {};
        // Assuming that we only have one lightning close input in each transaction. This may not be true in the future
        const foundChannelsFromInput = channels.find((channel) => channel.closing_transaction_id === txid);
        if (foundChannelsFromInput) {
          inputs[0] = foundChannelsFromInput;
        }
        const foundChannelsFromOutputs = channels.filter((channel) => channel.transaction_id === txid);
        for (const output of foundChannelsFromOutputs) {
          outputs[output.transaction_vout] = output;
        }
        result.push({
          inputs,
          outputs,
        });
      }

      res.json(result);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get channels by transaction ids');
    }
  }

  private async $getPenaltyClosedChannels(req: Request, res: Response): Promise<void> {
    try {
      const channels = await channelsApi.$getPenaltyClosedChannels();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(channels);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get penalty closed channels');
    }
  }

  private async $getAllChannelsGeo(req: Request, res: Response) {
    try {
      const style: string = typeof req.query.style === 'string' ? req.query.style : '';
      const channels = await channelsApi.$getAllChannelsGeo(req.params?.publicKey, style);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(channels);
    } catch (e) {
      handleError(req, res, 500, 'Failed to get channel geodata');
    }
  }

}

export default new ChannelsRoutes();
