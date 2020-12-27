import bitcoinApi from './bitcoin/bitcoin-api-factory';
import logger from '../logger';
import { TransactionExtended, TransactionMinerInfo } from '../mempool.interfaces';
import { IEsploraApi } from './bitcoin/esplora-api.interface';

class TransactionUtils {
  constructor() { }

  public async $addPrevoutsToTransaction(transaction: TransactionExtended): Promise<TransactionExtended> {
    if (transaction.vin[0].is_coinbase) {
      return transaction;
    }
    for (const vin of transaction.vin) {
      const innerTx = await bitcoinApi.$getRawTransaction(vin.txid);
      vin.prevout = innerTx.vout[vin.vout];
    }
    return transaction;
  }

  public extendTransaction(transaction: IEsploraApi.Transaction): TransactionExtended {
    transaction['vsize'] = Math.round(transaction.weight / 4);
    transaction['feePerVsize'] = Math.max(1, (transaction.fee || 0) / (transaction.weight / 4));
    if (!transaction.status.confirmed) {
      transaction['firstSeen'] = Math.round((new Date().getTime() / 1000));
    }
    // @ts-ignore
    return transaction;
  }

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

  public async $getTransactionExtended(txId: string, inMempool = false, addPrevouts = false): Promise<TransactionExtended | null> {
    try {
      let transaction: IEsploraApi.Transaction;
      if (inMempool) {
        transaction = await bitcoinApi.$getRawTransactionBitcoind(txId, false, addPrevouts);
      } else {
        transaction = await bitcoinApi.$getRawTransaction(txId, false, addPrevouts);
      }
      return this.extendTransaction(transaction);
    } catch (e) {
      logger.debug('getTransactionExtended error: ' + (e.message || e));
      console.log(e);
      return null;
    }
  }

}

export default new TransactionUtils();
