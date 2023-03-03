import { TransactionExtended, TransactionMinerInfo } from '../mempool.interfaces';
import { IEsploraApi } from './bitcoin/esplora-api.interface';
import { Common } from './common';
import bitcoinApi, { bitcoinCoreApi } from './bitcoin/bitcoin-api-factory';

class TransactionUtils {
  constructor() { }

  public stripCoinbaseTransaction(tx: TransactionExtended): TransactionMinerInfo {
    return {
      vin: [{
        scriptsig: tx.vin[0].scriptsig || tx.vin[0]['coinbase']
      }],
      vout: tx.vout
        .map((vout) => ({
          scriptpubkey_address: vout.scriptpubkey_address,
          scriptpubkey_asm: vout.scriptpubkey_asm,
          value: vout.value
        }))
        .filter((vout) => vout.value)
    };
  }

  /**
   * @param txId 
   * @param addPrevouts 
   * @param lazyPrevouts 
   * @param forceCore - See https://github.com/mempool/mempool/issues/2904
   */
  public async $getTransactionExtended(txId: string, addPrevouts = false, lazyPrevouts = false, forceCore = false): Promise<TransactionExtended> {
    let transaction: IEsploraApi.Transaction;
    if (forceCore === true) {
      transaction  = await bitcoinCoreApi.$getRawTransaction(txId, true);
    } else {
      transaction  = await bitcoinApi.$getRawTransaction(txId, false, addPrevouts, lazyPrevouts);
    }
    return this.extendTransaction(transaction);
  }

  private extendTransaction(transaction: IEsploraApi.Transaction): TransactionExtended {
    // @ts-ignore
    if (transaction.vsize) {
      // @ts-ignore
      return transaction;
    }
    const feePerVbytes = Math.max(Common.isLiquid() ? 0.1 : 1,
      (transaction.fee || 0) / (transaction.weight / 4));
    const transactionExtended: TransactionExtended = Object.assign({
      vsize: Math.round(transaction.weight / 4),
      feePerVsize: feePerVbytes,
      effectiveFeePerVsize: feePerVbytes,
    }, transaction);
    if (!transaction.status.confirmed) {
      transactionExtended.firstSeen = Math.round((new Date().getTime() / 1000));
    }
    return transactionExtended;
  }

  public hex2ascii(hex: string) {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
  }
}

export default new TransactionUtils();
