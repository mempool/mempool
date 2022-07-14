import { Application, Request, Response } from 'express';
import config from '../../config';
import { RequiredSpec } from '../../mempool.interfaces';
import bisq from './bisq';
import { MarketsApiError } from './interfaces';
import marketsApi from './markets-api';

class BisqRoutes {
  public initRoutes(app: Application) {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/stats', this.getBisqStats)
      .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/tx/:txId', this.getBisqTransaction)
      .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/block/:hash', this.getBisqBlock)
      .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/blocks/tip/height', this.getBisqTip)
      .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/blocks/:index/:length', this.getBisqBlocks)
      .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/address/:address', this.getBisqAddress)
      .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/txs/:index/:length', this.getBisqTransactions)
      .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/markets/currencies', this.getBisqMarketCurrencies.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/markets/depth', this.getBisqMarketDepth.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/markets/hloc', this.getBisqMarketHloc.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/markets/markets', this.getBisqMarketMarkets.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/markets/offers', this.getBisqMarketOffers.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/markets/ticker', this.getBisqMarketTicker.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/markets/trades', this.getBisqMarketTrades.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/markets/volumes', this.getBisqMarketVolumes.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/markets/volumes/7d', this.getBisqMarketVolumes7d.bind(this))
    ;
  }


  private getBisqStats(req: Request, res: Response) {
    const result = bisq.getStats();
    res.json(result);
  }

  private getBisqTip(req: Request, res: Response) {
    const result = bisq.getLatestBlockHeight();
    res.type('text/plain');
    res.send(result.toString());
  }

  private getBisqTransaction(req: Request, res: Response) {
    const result = bisq.getTransaction(req.params.txId);
    if (result) {
      res.json(result);
    } else {
      res.status(404).send('Bisq transaction not found');
    }
  }

  private getBisqTransactions(req: Request, res: Response) {
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

  private getBisqBlock(req: Request, res: Response) {
    const result = bisq.getBlock(req.params.hash);
    if (result) {
      res.json(result);
    } else {
      res.status(404).send('Bisq block not found');
    }
  }

  private getBisqBlocks(req: Request, res: Response) {
    const index = parseInt(req.params.index, 10) || 0;
    const length = parseInt(req.params.length, 10) > 100 ? 100 : parseInt(req.params.length, 10) || 25;
    const [transactions, count] = bisq.getBlocks(index, length);
    res.header('X-Total-Count', count.toString());
    res.json(transactions);
  }

  private getBisqAddress(req: Request, res: Response) {
    const result = bisq.getAddress(req.params.address.substr(1));
    if (result) {
      res.json(result);
    } else {
      res.status(404).send('Bisq address not found');
    }
  }

  private getBisqMarketCurrencies(req: Request, res: Response) {
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

    const result = marketsApi.getCurrencies(p.type);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketCurrencies error'));
    }
  }

  private getBisqMarketDepth(req: Request, res: Response) {
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

    const result = marketsApi.getDepth(p.market);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketDepth error'));
    }
  }

  private getBisqMarketMarkets(req: Request, res: Response) {
    const result = marketsApi.getMarkets();
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketMarkets error'));
    }
  }

  private getBisqMarketTrades(req: Request, res: Response) {
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

    const result = marketsApi.getTrades(p.market, p.timestamp_from,
      p.timestamp_to, p.trade_id_from, p.trade_id_to, p.direction, p.limit, p.sort);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketTrades error'));
    }
  }

  private getBisqMarketOffers(req: Request, res: Response) {
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

    const result = marketsApi.getOffers(p.market, p.direction);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketOffers error'));
    }
  }

  private getBisqMarketVolumes(req: Request, res: Response) {
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

    const result = marketsApi.getVolumes(p.market, p.timestamp_from, p.timestamp_to, p.interval, p.milliseconds, p.timestamp);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketVolumes error'));
    }
  }

  private getBisqMarketHloc(req: Request, res: Response) {
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

    const result = marketsApi.getHloc(p.market, p.interval, p.timestamp_from, p.timestamp_to, p.milliseconds, p.timestamp);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketHloc error'));
    }
  }

  private getBisqMarketTicker(req: Request, res: Response) {
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

    const result = marketsApi.getTicker(p.market);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketTicker error'));
    }
  }

  private getBisqMarketVolumes7d(req: Request, res: Response) {
    const result = marketsApi.getVolumesByTime(604800);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketVolumes7d error'));
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

export default new BisqRoutes;
