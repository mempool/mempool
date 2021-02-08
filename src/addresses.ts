import api from './api';

const getAddress = async (params: { address: string }) => {
  return api
    .get(`/address/${params.address}`)
    .then(
      (res: {
        data: {
          address: string;
          chain_stats: {
            funded_txo_count: number;
            funded_txo_sum: number;
            spent_txo_count: number;
            spent_txo_sum: number;
            tx_count: number;
          };
          mempool_stats: {
            funded_txo_count: number;
            funded_txo_sum: number;
            spent_txo_count: number;
            spent_txo_sum: number;
            tx_count: number;
          };
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

const getAddressTxs = async (params: { address: string }) => {
  return api
    .get(`/address/${params.address}/txs`)
    .then(
      (res: {
        data: {
          txid: string;
          version: number;
          locktime: number;
          vin: Record<string, unknown>[];
          vout: Record<string, unknown>[];
          size: number;
          weight: number;
          fee: number;
          status: {
            confirmed: boolean;
            block_height: number;
            block_hash: string;
            block_time: number;
          };
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

const getAddressTxsChain = async (params: { address: string }) => {
  return api
    .get(`/address/${params.address}/txs/chain`)
    .then(
      (res: {
        data: {
          txid: string;
          version: number;
          locktime: number;
          vin: Record<string, unknown>[];
          vout: Record<string, unknown>[];
          size: number;
          weight: number;
          fee: number;
          status: {
            confirmed: boolean;
            block_height: number;
            block_hash: string;
            block_time: number;
          };
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

const getAddressTxsMempool = async (params: { address: string }) => {
  return api
    .get(`/address/${params.address}/txs/mempool`)
    .then((res: { data: any }) => {
      return res.data;
    })
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

const getAddressTxsUtxo = async (params: { address: string }) => {
  return api
    .get(`/address/${params.address}/utxo`)
    .then(
      (res: {
        data: {
          txid: string;
          vout: number;
          status: {
            confirmed: boolean;
            block_height: number;
            block_hash: string;
            block_time: number;
          };
          value: number;
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
  getAddress,
  getAddressTxs,
  getAddressTxsChain,
  getAddressTxsMempool,
  getAddressTxsUtxo,
};
