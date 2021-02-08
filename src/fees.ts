import api from './api';

const getFeesRecommended = async () => {
  return await api
    .get(`/v1/fees/recommended`)
    .then(
      (res: {
        data: {
          fastestFee: number;
          halfHourFee: number;
          hourFee: number;
        };
      }) => {
        return res.data;
      }
    )
    .catch(
      (err: {
        response: {
          data: string;
        };
      }) => {
        throw err.response.data;
      }
    );
};

const getFeesMempoolBlocks = async () => {
  return await api
    .get(`/v1/fees/mempool-blocks`)
    .then(
      (res: {
        data: {
          blockSize: number;
          blockVSize: number;
          nTx: number;
          totalFees: number;
          medianFee: number;
          feeRange: number[];
        }[];
      }) => {
        return res.data;
      }
    )
    .catch(
      (err: {
        response: {
          data: string;
        };
      }) => {
        throw err.response.data;
      }
    );
};

export default {
  getFeesRecommended,
  getFeesMempoolBlocks,
};
