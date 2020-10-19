import config from './config';
import { Request, Response } from 'express';
import statistics from './api/statistics';
import feeApi from './api/fee-api';
import backendInfo from './api/backend-info';
import mempoolBlocks from './api/mempool-blocks';
import mempool from './api/mempool';
import bisq from './api/bisq/bisq';
import bisqMarket from './api/bisq/markets-api';
import { RequiredSpec } from './interfaces';
import { MarketsApiError } from './api/bisq/interfaces';
import donations from './api/donations';
import logger from './logger';

class Routes {
  private cache = {};

  constructor() {
    if (!config.DATABASE.ENABLED) {
      this.createCache();
      setInterval(this.createCache.bind(this), 600000);
    }
  }

  private async createCache() {
    this.cache['24h'] = await statistics.$list24H();
    this.cache['1w'] = await statistics.$list1W();
    this.cache['1m'] = await statistics.$list1M();
    this.cache['3m'] = await statistics.$list3M();
    this.cache['6m'] = await statistics.$list6M();
    this.cache['1y'] = await statistics.$list1Y();
    logger.debug('Statistics cache created');
  }

  public async get2HStatistics(req: Request, res: Response) {
    const result = await statistics.$list2H();
    res.json(result);
  }

  public get24HStatistics(req: Request, res: Response) {
    res.json(this.cache['24h']);
  }

  public get1WHStatistics(req: Request, res: Response) {
    res.json(this.cache['1w']);
  }

  public get1MStatistics(req: Request, res: Response) {
    res.json(this.cache['1m']);
  }

  public get3MStatistics(req: Request, res: Response) {
    res.json(this.cache['3m']);
  }

  public get6MStatistics(req: Request, res: Response) {
    res.json(this.cache['6m']);
  }

  public get1YStatistics(req: Request, res: Response) {
    res.json(this.cache['1y']);
  }

  public async getRecommendedFees(req: Request, res: Response) {
    if (!mempool.isInSync()) {
      res.statusCode = 503;
      res.send('Service Unavailable');
      return;
    }
    const result = feeApi.getRecommendedFee();
    res.json(result);
  }

  public getMempoolBlocks(req: Request, res: Response) {
    try {
      const result = mempoolBlocks.getMempoolBlocks();
      res.json(result);
    } catch (e) {
      res.status(500).send(e.message);
    }
  }

  public getTransactionTimes(req: Request, res: Response) {
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

    const times = mempool.getFirstSeenForTransactions(txIds);
    res.json(times);
  }

  public getBackendInfo(req: Request, res: Response) {
    res.json(backendInfo.getBackendInfo());
  }

  public async createDonationRequest(req: Request, res: Response) {
    const constraints: RequiredSpec = {
      'amount': {
        required: true,
        types: ['@float']
      },
      'orderId': {
        required: true,
        types: ['@string']
      }
    };

    const p = this.parseRequestParameters(req.body, constraints);
    if (p.error) {
      res.status(400).send(p.error);
      return;
    }

    if (p.orderId !== '' && !/^(@|)[a-zA-Z0-9_]{1,15}$/.test(p.orderId)) {
      res.status(400).send('Invalid Twitter handle');
      return;
    }

    if (p.amount < 0.001) {
      res.status(400).send('Amount needs to be at least 0.001');
      return;
    }

    if (p.amount > 1000) {
      res.status(400).send('Amount too large');
      return;
    }

    try {
      const result = await donations.createRequest(p.amount, p.orderId);
      res.json(result);
    } catch (e) {
      res.status(500).send(e.message);
    }
  }

  public async getDonations(req: Request, res: Response) {
    try {
      const result = await donations.$getDonationsFromDatabase('handle, imageUrl');
      res.json(result);
    } catch (e) {
      res.status(500).send(e.message);
    }
  }

  public async getSponsorImage(req: Request, res: Response) {
    try {
      const result = await donations.getSponsorImage(req.params.id);
      if (result) {
        res.set('Content-Type', 'image/jpeg');
        res.send(result);
      } else {
        res.status(404).end();
      }
    } catch (e) {
      res.status(500).send(e.message);
    }
  }

  public async donationWebhook(req: Request, res: Response) {
    try {
      donations.$handleWebhookRequest(req.body);
      res.end();
    } catch (e) {
      res.status(500).send(e);
    }
  }

  public getBisqStats(req: Request, res: Response) {
    const result = bisq.getStats();
    res.json(result);
  }

  public getBisqTip(req: Request, res: Response) {
    const result = bisq.getLatestBlockHeight();
    res.type('text/plain');
    res.send(result.toString());
  }

  public getBisqTransaction(req: Request, res: Response) {
    const result = bisq.getTransaction(req.params.txId);
    if (result) {
      res.json(result);
    } else {
      res.status(404).send('Bisq transaction not found');
    }
  }

  public getBisqTransactions(req: Request, res: Response) {
    const types: string[] = [];
    req.query.types = req.query.types || [];
    if (!Array.isArray(req.query.types)) {
      res.status(500).send('Types is not an array');
      return;
    }

    for (const _type in req.query.types) {
      if (typeof req.query.types[_type] === 'string') {
        types.push(req.query.types[_type].toString());
      }
    }

    const index = parseInt(req.params.index, 10) || 0;
    const length = parseInt(req.params.length, 10) > 100 ? 100 : parseInt(req.params.length, 10) || 25;
    const [transactions, count] = bisq.getTransactions(index, length, types);
    res.header('X-Total-Count', count.toString());
    res.json(transactions);
  }

  public getBisqBlock(req: Request, res: Response) {
    const result = bisq.getBlock(req.params.hash);
    if (result) {
      res.json(result);
    } else {
      res.status(404).send('Bisq block not found');
    }
  }

  public getBisqBlocks(req: Request, res: Response) {
    const index = parseInt(req.params.index, 10) || 0;
    const length = parseInt(req.params.length, 10) > 100 ? 100 : parseInt(req.params.length, 10) || 25;
    const [transactions, count] = bisq.getBlocks(index, length);
    res.header('X-Total-Count', count.toString());
    res.json(transactions);
  }

  public getBisqAddress(req: Request, res: Response) {
    const result = bisq.getAddress(req.params.address.substr(1));
    if (result) {
      res.json(result);
    } else {
      res.status(404).send('Bisq address not found');
    }
  }

  public getBisqMarketCurrencies(req: Request, res: Response) {
    const constraints: RequiredSpec = {
      'type': {
        required: false,
        types: ['crypto', 'fiat', 'all']
      },
    };

    const p = this.parseRequestParameters(req.query, constraints);
    if (p.error) {
      res.status(400).json(this.getBisqMarketErrorResponse(p.error));
      return;
    }

    const result = bisqMarket.getCurrencies(p.type);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketCurrencies error'));
    }
  }

  public getBisqMarketDepth(req: Request, res: Response) {
    const constraints: RequiredSpec = {
      'market': {
        required: true,
        types: ['@string']
      },
    };

    const p = this.parseRequestParameters(req.query, constraints);
    if (p.error) {
      res.status(400).json(this.getBisqMarketErrorResponse(p.error));
      return;
    }

    const result = bisqMarket.getDepth(p.market);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketDepth error'));
    }
  }

  public getBisqMarketMarkets(req: Request, res: Response) {
    const result = bisqMarket.getMarkets();
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketMarkets error'));
    }
  }

  public getBisqMarketTrades(req: Request, res: Response) {
    const constraints: RequiredSpec = {
      'market': {
        required: true,
        types: ['@string']
      },
      'timestamp_from': {
        required: false,
        types: ['@number']
      },
      'timestamp_to': {
        required: false,
        types: ['@number']
      },
      'trade_id_to': {
        required: false,
        types: ['@string']
      },
      'trade_id_from': {
        required: false,
        types: ['@string']
      },
      'direction': {
        required: false,
        types: ['buy', 'sell']
      },
      'limit': {
        required: false,
        types: ['@number']
      },
      'sort': {
        required: false,
        types: ['asc', 'desc']
      }
    };

    const p = this.parseRequestParameters(req.query, constraints);
    if (p.error) {
      res.status(400).json(this.getBisqMarketErrorResponse(p.error));
      return;
    }

    const result = bisqMarket.getTrades(p.market, p.timestamp_from,
      p.timestamp_to, p.trade_id_from, p.trade_id_to, p.direction, p.limit, p.sort);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketTrades error'));
    }
  }

  public getBisqMarketOffers(req: Request, res: Response) {
    const constraints: RequiredSpec = {
      'market': {
        required: true,
        types: ['@string']
      },
      'direction': {
        required: false,
        types: ['buy', 'sell']
      },
    };

    const p = this.parseRequestParameters(req.query, constraints);
    if (p.error) {
      res.status(400).json(this.getBisqMarketErrorResponse(p.error));
      return;
    }

    const result = bisqMarket.getOffers(p.market, p.direction);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketOffers error'));
    }
  }

  public getBisqMarketVolumes(req: Request, res: Response) {
    const constraints: RequiredSpec = {
      'market': {
        required: false,
        types: ['@string']
      },
      'interval': {
        required: false,
        types: ['minute', 'half_hour', 'hour', 'half_day', 'day', 'week', 'month', 'year', 'auto']
      },
      'timestamp_from': {
        required: false,
        types: ['@number']
      },
      'timestamp_to': {
        required: false,
        types: ['@number']
      },
      'milliseconds': {
        required: false,
        types: ['@boolean']
      },
      'timestamp': {
        required: false,
        types: ['no', 'yes']
      },
    };

    const p = this.parseRequestParameters(req.query, constraints);
    if (p.error) {
      res.status(400).json(this.getBisqMarketErrorResponse(p.error));
      return;
    }

    const result = bisqMarket.getVolumes(p.market, p.timestamp_from, p.timestamp_to, p.interval, p.milliseconds, p.timestamp);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketVolumes error'));
    }
  }

  public getBisqMarketHloc(req: Request, res: Response) {
    const constraints: RequiredSpec = {
      'market': {
        required: true,
        types: ['@string']
      },
      'interval': {
        required: false,
        types: ['minute', 'half_hour', 'hour', 'half_day', 'day', 'week', 'month', 'year', 'auto']
      },
      'timestamp_from': {
        required: false,
        types: ['@number']
      },
      'timestamp_to': {
        required: false,
        types: ['@number']
      },
      'milliseconds': {
        required: false,
        types: ['@boolean']
      },
      'timestamp': {
        required: false,
        types: ['no', 'yes']
      },
    };

    const p = this.parseRequestParameters(req.query, constraints);
    if (p.error) {
      res.status(400).json(this.getBisqMarketErrorResponse(p.error));
      return;
    }

    const result = bisqMarket.getHloc(p.market, p.interval, p.timestamp_from, p.timestamp_to, p.milliseconds, p.timestamp);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketHloc error'));
    }
  }

  public getBisqMarketTicker(req: Request, res: Response) {
    const constraints: RequiredSpec = {
      'market': {
        required: false,
        types: ['@string']
      },
    };

    const p = this.parseRequestParameters(req.query, constraints);
    if (p.error) {
      res.status(400).json(this.getBisqMarketErrorResponse(p.error));
      return;
    }

    const result = bisqMarket.getTicker(p.market);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketTicker error'));
    }
  }

  private parseRequestParameters(requestParams: object, params: RequiredSpec): { [name: string]: any; } {
    const final = {};
    for (const i in params) {
      if (params.hasOwnProperty(i)) {
        if (params[i].required && requestParams[i] === undefined) {
          return { error: i + ' parameter missing'};
        }
        if (typeof requestParams[i] === 'string') {
          const str = (requestParams[i] || '').toString().toLowerCase();
          if (params[i].types.indexOf('@number') > -1) {
            const number = parseInt((str).toString(), 10);
            final[i] = number;
          } else if (params[i].types.indexOf('@string') > -1) {
            final[i] = str;
          } else if (params[i].types.indexOf('@boolean') > -1) {
            final[i] = str === 'true' || str === 'yes';
          } else if (params[i].types.indexOf(str) > -1) {
            final[i] = str;
          } else {
            return { error: i + ' parameter invalid'};
          }
        } else if (typeof requestParams[i] === 'number') {
          final[i] = requestParams[i];
        }
      }
    }
    return final;
  }

  private getBisqMarketErrorResponse(message: string): MarketsApiError {
    return {
      'success': 0,
      'error': message
    };
  }

}

export default new Routes();
