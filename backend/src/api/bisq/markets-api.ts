import { Currencies, OffsersData, TradesData, Depth, Currency, Interval, HighLowOpenClose,
  Markets, Offers, Offer, BisqTrade, MarketVolume, Tickers } from './interfaces';

import * as datetime from 'locutus/php/datetime';

class BisqMarketsApi {
  private cryptoCurrencyData: Currency[] = [];
  private fiatCurrencyData: Currency[] = [];
  private offersData: OffsersData[] = [];
  private tradesData: TradesData[] = [];

  constructor() { }

  public setData(cryptoCurrency: Currency[], fiatCurrency: Currency[], offers: OffsersData[], trades: TradesData[]) {
    this.cryptoCurrencyData = cryptoCurrency,
    this.fiatCurrencyData = fiatCurrency;
    this.offersData = offers;
    this.tradesData = trades;

    this.fiatCurrencyData.forEach((currency) => currency._type = 'fiat');
    this.cryptoCurrencyData.forEach((currency) => currency._type = 'crypto');
    this.tradesData.forEach((trade) => {
      trade._market = trade.currencyPair.toLowerCase().replace('/', '_');
    });
  }

  getCurrencies(
    type: 'crypto' | 'fiat' | 'all' = 'all',
  ): Currencies {
    let currencies: Currency[];

    switch (type) {
      case 'fiat':
        currencies = this.fiatCurrencyData;
        break;
      case 'crypto':
        currencies = this.cryptoCurrencyData;
        break;
      case 'all':
      default:
        currencies = this.cryptoCurrencyData.concat(this.fiatCurrencyData);
    }
    const result = {};
    currencies.forEach((currency) => {
      result[currency.code] = currency;
    });
    return result;
  }

  getDepth(
    market: string,
  ): Depth {
    const currencyPair = market.replace('_', '/').toUpperCase();

    const buys = this.offersData
      .filter((offer) => offer.currencyPair === currencyPair && offer.primaryMarketDirection === 'BUY')
      .map((offer) => offer.price)
      .sort((a, b) => b - a)
      .map((price) => this.intToBtc(price));

    const sells = this.offersData
      .filter((offer) => offer.currencyPair === currencyPair && offer.primaryMarketDirection === 'SELL')
      .map((offer) => offer.price)
      .sort((a, b) => a - b)
      .map((price) => this.intToBtc(price));

    const result = {};
    result[market] = {
      'buys': buys,
      'sells': sells,
    };
    return result;
  }

  getOffers(
    market: string,
    direction?: 'buy' | 'sell',
  ): Offers {
    const currencyPair = market.replace('_', '/').toUpperCase();

    let buys: Offer[] | null = null;
    let sells: Offer[] | null = null;

    if (!direction || direction === 'buy') {
      buys = this.offersData
        .filter((offer) => offer.currencyPair === currencyPair && offer.primaryMarketDirection === 'BUY')
        .sort((a, b) => b.price - a.price)
        .map((offer) => this.offerDataToOffer(offer));
    }

    if (!direction || direction === 'sell') {
      sells = this.offersData
        .filter((offer) => offer.currencyPair === currencyPair && offer.primaryMarketDirection === 'SELL')
        .sort((a, b) => a.price - b.price)
        .map((offer) => this.offerDataToOffer(offer));
    }

    const result: Offers = {};
    result[market] = {
      'buys': buys,
      'sells': sells,
    };
    return result;
  }

  getMarkets(): Markets {
    const allCurrencies = this.getCurrencies();
    const markets = {};

    for (const currency of Object.keys(allCurrencies)) {
      if (allCurrencies[currency].code === 'BTC') {
        continue;
      }

      const isFiat = allCurrencies[currency]._type === 'fiat';
      const pmarketname = allCurrencies['BTC']['name'];

      const lsymbol = isFiat ? 'BTC' : currency;
      const rsymbol = isFiat ? currency : 'BTC';
      const lname = isFiat ? pmarketname : allCurrencies[currency].name;
      const rname = isFiat ? allCurrencies[currency].name : pmarketname;
      const ltype = isFiat ? 'crypto' : allCurrencies[currency]._type;
      const rtype = isFiat ? 'fiat' : 'crypto';
      const lprecision = 8;
      const rprecision = isFiat ? 2 : 8;
      const pair = lsymbol.toLowerCase() + '_' + rsymbol.toLowerCase();

      markets[pair] = {
        'pair': pair,
        'lname': lname,
        'rname': rname,
        'lsymbol': lsymbol,
        'rsymbol': rsymbol,
        'lprecision': lprecision,
        'rprecision': rprecision,
        'ltype': ltype,
        'rtype': rtype,
        'name': lname + '/' + rname,
      };
    }

    return markets;
  }

  getTrades(
    market: string,
    timestamp_from?: number,
    timestamp_to?: number,
    trade_id_from?: string,
    trade_id_to?: string,
    direction?: 'buy' | 'sell',
    limit: number = 100,
    sort: 'asc' | 'desc' = 'desc',
  ): BisqTrade[] {
      limit = Math.min(limit, 2000);
      const _market = market === 'all' ? null : market;

      if (!timestamp_from) {
        timestamp_from = new Date('2016-01-01').getTime() / 1000;
      }
      if (!timestamp_to) {
        timestamp_to = new Date().getTime() / 1000;
      }

      const matches = this.getTradesByCriteria(_market, timestamp_to, timestamp_from, trade_id_to, trade_id_from, direction, sort, limit);

      if (sort === 'asc') {
        matches.sort((a, b) => a.tradeDate - b.tradeDate);
      } else {
        matches.sort((a, b) => b.tradeDate - a.tradeDate);
      }

      return matches.map((trade) => {
        const bsqTrade: BisqTrade = {
          direction: trade.primaryMarketDirection,
          price: trade._tradePriceStr,
          amount: trade._tradeAmountStr,
          volume: trade._tradeVolumeStr,
          payment_method: trade.paymentMethod,
          trade_id: trade.offerId,
          trade_date: trade.tradeDate,
        };
        if (market === 'all') {
          bsqTrade.market = trade._market;
        }
        return bsqTrade;
      });
  }

  getVolumes(
    timestamp_from: number,
    timestamp_to: number,
    interval: Interval,
    market?: string,
    ): MarketVolume[] {
    return [];
  }

  getTicker(
    market?: string,
  ): Tickers {
    return {};
  }

  getHloc(
    market: string,
    interval: Interval = 'auto',
    timestamp_from?: number,
    timestamp_to?: number,
    milliseconds?: boolean,
  ): HighLowOpenClose[] {
    if (milliseconds) {
      timestamp_from = timestamp_from ? timestamp_from / 1000 : timestamp_from;
      timestamp_to = timestamp_to ? timestamp_to / 1000 : timestamp_to;
    }
    if (!timestamp_from) {
      timestamp_from = new Date('2016-01-01').getTime() / 1000;
    }
    if (!timestamp_to) {
      timestamp_to = new Date().getTime() / 1000;
    }

    const range = timestamp_to - timestamp_from;

    const trades = this.getTradesByCriteria(market, timestamp_to, timestamp_from,
      undefined, undefined, undefined, 'asc', Number.MAX_SAFE_INTEGER);

    if (interval === 'auto') {
        // two days range loads minute data
        if (range <= 3600) {
          // up to one hour range loads minutely data
          interval = 'minute';
        } else if (range <= 1 * 24 * 3600) {
          // up to one day range loads half-hourly data
          interval = 'half_hour';
        } else if (range <= 3 * 24 * 3600) {
          // up to 3 day range loads hourly data
          interval = 'hour';
        } else if (range <= 7 * 24 * 3600) {
          // up to 7 day range loads half-daily data
          interval = 'half_day';
        } else if (range <= 60 * 24 * 3600) {
          // up to 2 month range loads daily data
          interval = 'day';
        } else if (range <= 12 * 31 * 24 * 3600) {
          // up to one year range loads weekly data
          interval = 'week';
        } else if (range <= 12 * 31 * 24 * 3600) {
          // up to 5 year range loads monthly data
          interval = 'month';
        } else {
          // greater range loads yearly data
          interval = 'year';
        }
    }

    const hlocs = this.getTradesSummarized(trades, timestamp_from, interval);

    return hlocs;
  }

  private getTradesSummarized(trades: TradesData[], timestamp_from, interval: string): HighLowOpenClose[] {
    const intervals: any = {};
    const intervals_prices: any = {};
    const one_period = false;

    for (const trade of trades) {
      const traded_at = trade.tradeDate / 1000;
      const interval_start = one_period ? timestamp_from : this.intervalStart(traded_at, interval);

      if (!intervals[interval_start]) {
          intervals[interval_start] = {
            'open': 0,
            'close': 0,
            'high': 0,
            'low': 0,
            'avg': 0,
            'volume_right': 0,
            'volume_left': 0,
        };
        intervals_prices[interval_start] = [];
      }
      const period = intervals[interval_start];
      const price = trade._tradePrice;

      if (!intervals_prices[interval_start]['leftvol']) {
        intervals_prices[interval_start]['leftvol'] = [];
      }
      if (!intervals_prices[interval_start]['rightvol']) {
        intervals_prices[interval_start]['rightvol'] = [];
      }

      intervals_prices[interval_start]['leftvol'].push(trade._tradeAmount);
      intervals_prices[interval_start]['rightvol'].push(trade._tradeVolume);

      if (price) {
          const plow = period['low'];
          period['period_start'] = interval_start;
          period['open'] = period['open'] || price;
          period['close'] = price;
          period['high'] = price > period['high'] ? price : period['high'];
          period['low'] = (plow && price > plow) ? period['low'] : price;
          period['avg'] = intervals_prices[interval_start]['rightvol'].reduce((p: number, c: number) => c + p, 0)
            / intervals_prices[interval_start]['leftvol'].reduce((c: number, p: number) => c + p, 0) * 100000000;
          period['volume_left'] += trade._tradeAmount;
          period['volume_right'] += trade._tradeVolume;
      }
    }

    const hloc: HighLowOpenClose[] = [];

    for (const p in intervals) {
      if (intervals.hasOwnProperty(p)) {
        const period = intervals[p];
        hloc.push({
          period_start: period['period_start'],
          open: this.intToBtc(period['open']),
          close: this.intToBtc(period['close']),
          high: this.intToBtc(period['high']),
          low: this.intToBtc(period['low']),
          avg: this.intToBtc(period['avg']),
          volume_right: this.intToBtc(period['volume_right']),
          volume_left: this.intToBtc(period['volume_left']),
        });
      }
    }

    return hloc;
  }

  private getTradesByCriteria(
    market: string | null,
    timestamp_to: number,
    timestamp_from: number,
    trade_id_to: string | undefined,
    trade_id_from: string | undefined,
    direction: 'buy' | 'sell' | undefined,
    sort: string, limit: number,
    integerAmounts: boolean = true,
 ): TradesData[] {
    let trade_id_from_ts: number | null = null;
    let trade_id_to_ts: number | null = null;
    const allCurrencies = this.getCurrencies();

    const timestampFromMilli = timestamp_from * 1000;
    const timestampToMilli = timestamp_to * 1000;

    // note: the offer_id_from/to depends on iterating over trades in
    // descending chronological order.
    const tradesDataSorted = this.tradesData.slice();
    if (sort === 'asc') {
      tradesDataSorted.reverse();
    }

    let matches: TradesData[] = [];
    for (const trade of tradesDataSorted) {
      if (trade_id_from === trade.offerId) {
        trade_id_from_ts = trade.tradeDate;
      }
      if (trade_id_to === trade.offerId) {
        trade_id_to_ts = trade.tradeDate;
      }
      if (trade_id_to && trade_id_to_ts === null) {
        continue;
      }
      if (trade_id_from && trade_id_from_ts != null && trade_id_from_ts !== trade.tradeDate) {
        continue;
      }
      if (market && market !== trade._market) {
        continue;
      }
      if (timestampFromMilli && timestampFromMilli > trade.tradeDate) {
        continue;
      }
      if (timestampToMilli && timestampToMilli < trade.tradeDate) {
        continue;
      }
      if (direction && direction !== trade.direction.toLowerCase()) {
        continue;
      }

      // Filter out bogus trades with BTC/BTC or XXX/XXX market.
      // See github issue: https://github.com/bitsquare/bitsquare/issues/883
      const currencyPairs = trade.currencyPair.split('/');
      if (currencyPairs[0] === currencyPairs[1]) {
        continue;
      }

      const currencyLeft = allCurrencies[currencyPairs[0]];
      const currencyRight = allCurrencies[currencyPairs[1]];

      if (!currencyLeft || !currencyRight) {
        continue;
      }

      const tradePrice = trade.primaryMarketTradePrice * Math.pow(10, 8 - currencyRight.precision);
      const tradeAmount = trade.primaryMarketTradeAmount * Math.pow(10, 8 - currencyLeft.precision);
      const tradeVolume = trade.primaryMarketTradeVolume * Math.pow(10, 8 - currencyRight.precision);

      if (integerAmounts) {
        trade._tradePrice = tradePrice;
        trade._tradeAmount = tradeAmount;
        trade._tradeVolume = tradeVolume;
        trade._offerAmount = trade.offerAmount;
      } else {
        trade._tradePriceStr = this.intToBtc(tradePrice);
        trade._tradeAmountStr = this.intToBtc(tradeAmount);
        trade._tradeVolumeStr = this.intToBtc(tradeVolume);
        trade._offerAmountStr = this.intToBtc(trade.offerAmount);
      }

      matches.push(trade);

      if (matches.length >= limit) {
        break;
      }
    }

    if ((trade_id_from && !trade_id_from_ts) || (trade_id_to && !trade_id_to_ts)) {
      matches = [];
    }
    return matches;
  }

  private intervalStart(ts: number, interval: string) {
    switch (interval) {
        case 'minute':
            return (ts - (ts % 60));
        case '10_minute':
            return (ts - (ts % 600));
        case 'half_hour':
            return (ts - (ts % 1800));
        case 'hour':
            return (ts - (ts % 3600));
        case 'half_day':
            return (ts - (ts % (3600 * 12)));
        case 'day':
            return datetime.strtotime('midnight today', ts);
        case 'week':
            return datetime.strtotime('midnight sunday last week', ts);
        case 'month':
            return datetime.strtotime('midnight first day of this month', ts);
        case 'year':
            return datetime.strtotime('midnight first day of january', ts);
        default:
            throw new Error('Unsupported interval: ' + interval);
    }
}

  private offerDataToOffer(offer: OffsersData): Offer {
    return {
      offer_id: offer.id,
      offer_date: offer.date,
      direction: offer.direction,
      min_amount: this.intToBtc(offer.minAmount),
      amount: this.intToBtc(offer.amount),
      price: this.intToBtc(offer.price),
      volume: this.intToBtc(offer.primaryMarketVolume),
      payment_method: offer.paymentMethod,
      offer_fee_txid: null,
    };
  }

  private intToBtc(val: number): string {
    return (val / 100000000).toFixed(8);
  }
}

export default new BisqMarketsApi();
