import api from './api';

const getTx = async (params: { txid: string }) => {
  return api
    .get(`/tx/${params.txid}`)
    .then(
      (res: {
        data: {
          txid: string;
          version: number;
          locktime: number;
          vin: {
            txid: string;
            vout: number;
            prevout: {
              scriptpubkey: string;
              scriptpubkey_asm: string;
              scriptpubkey_type: string;
              scriptpubkey_address: string;
              value: number;
            };
            scriptsig: string;
            scriptsig_asm: string;
            is_coinbase: boolean;
            sequence: string;
          }[];
          vout: {
            scriptpubkey: string;
            scriptpubkey_asm: string;
            scriptpubkey_type: string;
            scriptpubkey_address: string;
            value: number;
          }[];
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

const getTxStatus = async (params: { txid: string }) => {
  return api
    .get(`/tx/${params.txid}/status`)
    .then(
      (res: {
        data: {
          confirmed: boolean;
          block_height: number;
          block_hash: string;
          block_time: number;
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

const getTxHex = async (params: { txid: string }) => {
  return api
    .get(`/tx/${params.txid}/hex`)
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

const getTxRaw = async (params: { txid: string }) => {
  return api
    .get(`/tx/${params.txid}/raw`)
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

const getTxMerkleBlockProof = async (params: { txid: string }) => {
  return api
    .get(`/tx/${params.txid}/merkleblock-proof`)
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

const getTxMerkleProof = async (params: { txid: string }) => {
  return api
    .get(`/tx/${params.txid}/merkle-proof`)
    .then(
      (res: {
        data: {
          block_height: number;
          merkle: string[];
          pos: number;
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

const getTxOutspend = async (params: { txid: string; vout: number }) => {
  return api
    .get(`/tx/${params.txid}/outspend/${params.vout}`)
    .then(
      (res: {
        data: {
          spent: boolean;
          txid: string;
          vin: number;
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

const getTxOutspends = async (params: { txid: string }) => {
  return api
    .get(`/tx/${params.txid}/outspends`)
    .then(
      (res: {
        data: {
          spent: boolean;
          txid: string;
          vin: number;
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

const postTx = async (params: { txid: string }) => {
  return api
    .post(`/tx`, { txid: params.txid })
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

export default {
  getTx,
  getTxStatus,
  getTxHex,
  getTxRaw,
  getTxMerkleBlockProof,
  getTxMerkleProof,
  getTxOutspend,
  getTxOutspends,
  postTx,
};
