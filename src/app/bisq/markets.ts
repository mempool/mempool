import { AxiosInstance } from 'axios';
import { Currencies, Depth, Markets, Hloc, MarketsInstance, Offers, Trades, Volumes } from '../../interfaces/bisq/markets';

export const useMarkets = (api: AxiosInstance): MarketsInstance => {

  const getCurrencies = async (
    params: {
      basecurrency?: string;
      type?: string;
      format?: string;
    } = {
      basecurrency: 'BTC',
      type: 'all',
      format: 'jsonpretty',
    }
  ) => {
    const { data } = await api.get<Currencies>('/currencies', { params });
    return data;
  };

  const getDepth = async (
    params: {
      market: string;
      format?: string;
    } = {
      market: 'xmr_btc',
      format: 'jsonpretty',
    }
  ) => {
    const { data } = await api.get<Depth>('/depth', { params });
    return data;
  };

  const getHloc = async (params: {
    market: string;
    interval?: string;
    timestamp_from?: string;
    timestamp_to?: string;
    format?: string;
  }) => {
    const { data } = await api.get<Hloc[]>('/hloc', { params });
    return data;
  };

  const getMarkets = async (
    params: {
      format?: string;
    } = {
      format: 'jsonpretty',
    }
  ) => {
    const { data } = await api.get<Markets>('/markets', { params });
    return data;
  };

  const getOffers = async (
    params: {
      market: string;
      direction?: string;
      format?: string;
    } = {
      market: 'xmr_btc',
      format: 'jsonpretty',
    }
  ) => {
    const { data } =  await api.get<Offers>('/offers', { params });
    return data;
  };

  const getTicker = async (
    params: {
      market?: string;
      format?: string;
    } = {
      format: 'jsonpretty',
    }
  ) => {
    const { data } = await api.get('/ticker', { params });
    return data;
  };

  const getTrades = async (
    params: {
      market: string;
      format?: string;
      timestamp_from?: string;
      timestamp_to?: string;
      trade_id_from?: string;
      trade_id_to?: string;
      limit?: number;
      sort?: string;
    } = {
      market: 'all',
      format: 'jsonpretty',
      timestamp_from: '2016-01-01',
      timestamp_to: 'now',
      limit: 100,
      sort: 'desc',
    }
  ) => {
    const { data } = await api.get<Trades[]>('/trades', { params });
    return data;
  };

  const getVolumes = async (
    params: {
      basecurrency: string;
      market: string;
      interval?: string;
      timestamp_from?: string;
      timestamp_to?: string;
      format?: string;
    } = {
      basecurrency: '',
      market: '',
      interval: 'auto',
      timestamp_from: '2016-01-01',
      timestamp_to: 'now',
      format: 'jsonpretty',
    }
  ) => {
    const { data } =  await api.get<Volumes[]>('/trades', { params });
    return data;
  };

  return {
    getCurrencies,
    getDepth,
    getHloc,
    getMarkets,
    getOffers,
    getTicker,
    getTrades,
    getVolumes,
  };
};

