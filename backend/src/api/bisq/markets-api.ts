import { Currencies, OffsersData, TradesData, Depth, Currency, Interval, HighLowOpenClose,
  Markets, Offers, Offer, BisqTrade, MarketVolume, Tickers } from './interfaces';

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
      let trade_id_from_ts: number | null = null;
      let trade_id_to_ts: number | null = null;
      const _market = market === 'all' ? null : market;

      if (!timestamp_from) {
        timestamp_from = new Date('2016-01-01').getTime();
      } else {
        timestamp_from = timestamp_from * 1000;
      }
      if (!timestamp_to) {
        timestamp_to = new Date().getTime();
      } else {
        timestamp_to = timestamp_to * 1000;
      }

      const allCurrencies = this.getCurrencies();

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
        if (trade_id_from && trade_id_from_ts != null && trade_id_from_ts !== trade.tradeDate ) {
          continue;
        }
        if (_market && _market !== trade._market) {
          continue;
        }
        if (timestamp_from && timestamp_from > trade.tradeDate) {
          continue;
        }
        if (timestamp_to && timestamp_to < trade.tradeDate) {
          continue;
        }
        if (direction && direction !== trade.direction.toLowerCase() ) {
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

        trade._tradePrice = this.intToBtc(tradePrice);
        trade._tradeAmount = this.intToBtc(tradeAmount);
        trade._tradeVolume = this.intToBtc(tradeVolume);
        trade._offerAmount = this.intToBtc(trade.offerAmount);

        matches.push(trade);

        if (matches.length >= limit) {
          break;
        }
      }

      if ((trade_id_from && !trade_id_from_ts) || (trade_id_to && !trade_id_to_ts) ) {
          matches = [];
      }

      if (sort === 'asc') {
        matches.sort((a, b) => a.tradeDate - b.tradeDate);
      } else {
        matches.sort((a, b) => b.tradeDate - a.tradeDate);
      }

      return matches.map((trade) => {
        const bsqTrade: BisqTrade = {
          direction: trade.primaryMarketDirection,
          price: trade._tradePrice,
          amount: trade._tradeAmount,
          volume: trade._tradeVolume,
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
  ): HighLowOpenClose[] {
    if (!timestamp_from) {
      timestamp_from = new Date('2016-01-01').getTime();
    } else {
      timestamp_from = timestamp_from * 1000;
    }
    if (!timestamp_to) {
      timestamp_to = new Date().getTime();
    } else {
      timestamp_to = timestamp_to * 1000;
    }
    return [];
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
