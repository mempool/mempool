export namespace IElectrumApi {
  export interface ScriptHashBalance {
    confirmed: number;
    unconfirmed: number;
  }

  export interface ScriptHashHistory {
    height: number;
    tx_hash: string;
    fee?: number;
  }

  export interface ScriptHashUtxos {
    tx_pos: number;
    value: number;
    tx_hash: string;
    height: number;
  }
}
