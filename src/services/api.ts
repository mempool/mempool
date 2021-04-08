import axios, { AxiosInstance } from 'axios';

export const makeAPI = (apiEndpoint?: string): { api: AxiosInstance } => {
  const api = axios.create({
    baseURL: apiEndpoint,
  });
  return {
    api,
  };
};
