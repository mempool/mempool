import axios, { AxiosInstance } from 'axios';
import { MempoolConfig } from './../../interfaces/index';

export const makeBitcoinAPI = ({
  hostname,
  network,
}: MempoolConfig): { api: AxiosInstance } => {
  if (network && ['testnet', 'signet'].includes(network)) {
    network = `/${network}`;
  } else {
    network = '';
  }
  const api = axios.create({
    baseURL: `https://${hostname}${network}/api/`,
  });
  return {
    api,
  };
};

export const makeBisqAPI = (hostname?: string): { api: AxiosInstance } => {
  const api = axios.create({
    baseURL: `https://${hostname}/bisq/api/`,
  });
  return {
    api,
  };
};

export const makeLiquidAPI = (hostname?: string): { api: AxiosInstance } => {
  const api = axios.create({
    baseURL: `https://${hostname}/liquid/api/`,
  });
  return {
    api,
  };
};

export default {
  makeBitcoinAPI,
  makeBisqAPI,
  makeLiquidAPI,
};
