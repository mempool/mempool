import bitcoinApi from './bitcoin/bitcoin-api-factory';
import logger from '../logger';
import { TransactionExtended, TransactionMinerInfo } from '../mempool.interfaces';
import { IEsploraApi } from './bitcoin/esplora-api.interface';

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
          value: vout.value
        }))
        .filter((vout) => vout.value)
    };
  }

  public async $getTransactionExtended(txId: string, forceBitcoind = false, addPrevouts = false): Promise<TransactionExtended> {
    let transaction: IEsploraApi.Transaction;
    if (forceBitcoind) {
      transaction = await bitcoinApi.$getRawTransactionBitcoind(txId, false, addPrevouts);
    } else {
      transaction = await bitcoinApi.$getRawTransaction(txId, false, addPrevouts);
    }
    return this.extendTransaction(transaction);
  }

  private extendTransaction(transaction: IEsploraApi.Transaction): TransactionExtended {
    const transactionExtended: TransactionExtended = Object.assign({
      vsize: Math.round(transaction.weight / 4),
      feePerVsize: Math.max(1, (transaction.fee || 0) / (transaction.weight / 4)),
    }, transaction);
    if (!transaction.status.confirmed) {
      transactionExtended.firstSeen = Math.round((new Date().getTime() / 1000));
    }
    return transactionExtended;
  }
}

export default new TransactionUtils();
