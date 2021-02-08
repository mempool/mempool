import api from './api';

const getBlock = async (params: { hash: string }) => {
  return api
    .get(`/block/${params.hash}`)
    .then(
      (res: {
        data: {
          id: string;
          height: number;
          version: number;
          timestamp: number;
          tx_count: number;
          size: number;
          weight: number;
          merkle_root: string;
          previousblockhash: string;
          mediantime: number;
          nonce: number;
          bits: number;
          difficulty: number;
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

const getBlockStatus = async (params: { hash: string }) => {
  return api
    .get(`/block/${params.hash}/status`)
    .then(
      (res: {
        data: {
          in_best_chain: boolean;
          height: number;
          next_best: string;
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

const getBlockTxs = async (params: { hash: string; start_index?: number }) => {
  return api
    .get(`/block/${params.hash}/txs/${params.start_index}`)
    .then(
      (res: {
        data: {
          txid: string;
          version: number;
          locktime: number;
          vin: Record<string, unknown>[];
          vout: Record<string, unknown>[][];
          size: number;
          weight: number;
          fee: number;
          status: {
            confirmed: boolean;
            block_height: number;
            block_hash: string;
            block_time: number;
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

const getBlockTxids = async (params: { hash: string }) => {
  return api
    .get(`/block/${params.hash}/txids`)
    .then((res: { data: string[] }) => {
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

const getBlockTxid = async (params: { hash: string; index: number }) => {
  return api
    .get(`/block/${params.hash}/txid/${params.index}`)
    .then((res: { data: string }) => {
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

const getBlockRaw = async (params: { hash: string }) => {
  return api
    .get(`/block/${params.hash}/raw`)
    .then((res: { data: string }) => {
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

const getBlockHeight = async (params: { height: number }) => {
  return api
    .get(`/block-height/${params.height}`)
    .then((res: { data: string }) => {
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

const getBlocks = async (params: { start_height?: number }) => {
  return api
    .get(`/blocks/${params.start_height}`)
    .then(
      (res: {
        data: {
          id: string;
          height: number;
          version: number;
          timestamp: number;
          tx_count: number;
          size: number;
          weight: number;
          merkle_root: string;
          previousblockhash: string;
          mediantime: number;
          nonce: number;
          bits: number;
          difficulty: number;
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

const getBlocksTipHeight = async () => {
  return api
    .get(`/blocks/tip/height`)
    .then((res: { data: number }) => {
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

const getBlocksTipHash = async () => {
  return api
    .get(`/blocks/tip/hash`)
    .then((res: { data: string }) => {
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

export default {
  getBlock,
  getBlocks,
  getBlockStatus,
  getBlockTxs,
  getBlockTxid,
  getBlockTxids,
  getBlockRaw,
  getBlockHeight,
  getBlocksTipHash,
  getBlocksTipHeight,
};
