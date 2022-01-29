export interface Currencies {
  [key: string]: {
    code: string;
    name: string;
    precision: number;
    _type: string;
  };
}

export interface Depth {
  [key: string]: {
    buys: string[];
    sells: string[];
  };
}

export interface Hloc {
  period_start: number;
  open: string;
  close: string;
  high: string;
  low: string;
  avg: string;
  volume_right: string;
  volume_left: string;
}

export interface Markets {
  [key: string]: {
    pair: string;
    lname: string;
    rname: string;
    lsymbol: string;
    rsymbol: string;
    lprecision: number;
    rprecision: number;
    ltype: string;
    rtype: string;
    name: string;
  };
}

export interface Offers {
  [key: string]: {
    buys: {
      offer_id: string;
      offer_date: number;
      direction: string;
      min_amount: string;
      amount: string;
      price: string;
      volume: string;
      payment_method: string;
      offer_fee_txid: string;
    }[];
    sells: {
      offer_id: string;
      offer_date: number;
      direction: string;
      min_amount: string;
      amount: string;
      price: string;
      volume: string;
      payment_method: string;
      offer_fee_txid: string;
    }[];
  };
}

export interface Ticker {
  [key: string]: {
    last: string;
    high: string;
    low: string;
    volume_left: number;
    volume_right: number;
    buy: string;
    sell: string;
  };
}

export interface Trades {
  price: string;
  amount: string;
  volume: string;
  payment_method: string;
  trade_date: number;
  market: string;
}

export interface Volumes {
  price: string;
  amount: string;
  volume: string;
  payment_method: string;
  trade_date: number;
}

export interface MarketsInstance {
  getCurrencies: (
    params?: {
      basecurrency?: string;
      type?: string;
      format?: string;
    }
  ) => Promise<Currencies>;

  getDepth: (
    params: {
      market: string;
      format?: string;
    }
  ) => Promise<Depth>;

  getHloc: (
    params: {
      market: string;
      interval?: string;
      timestamp_from?: string;
      timestamp_to?: string;
      format?: string;
    }
  ) => Promise<Hloc[]>;

  getMarkets: (
    params?: {
      format?: string;
    }
  ) => Promise<Markets>;

  getOffers: (
    params: {
      market: string;
      direction?: string;
      format?: string;
    }
  ) => Promise<Offers>;

  getTicker: (
    params: {
      market: string;
      format?: string;
    }
  ) => Promise<Ticker>;
  
  getTrades: (
    params: {
      market: string;
      format?: string;
      timestamp_from?: string;
      timestamp_to?: string;
      trade_id_from?: string;
      trade_id_to?: string;
      limit?: number;
      sort?: string;
    }
  ) => Promise<Trades[]>;

  getVolumes: (
    params: {
      basecurrency: string;
      market: string;
      interval?: string;
      timestamp_from?: string;
      timestamp_to?: string;
      format?: string;
    }
  ) => Promise<Volumes[]>;

}
