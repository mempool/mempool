import bitcoinApi from './bitcoin/bitcoin-api-factory';
import { TransactionExtended, TransactionMinerInfo } from '../mempool.interfaces';
import { IEsploraApi } from './bitcoin/esplora-api.interface';
import config from '../config';
import { Common } from './common';

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

  public async $getTransactionExtended(txId: string, addPrevouts = false): Promise<TransactionExtended> {
    const transaction: IEsploraApi.Transaction = await bitcoinApi.$getRawTransaction(txId, false, addPrevouts);
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

  public hex2ascii(hex: string): string {
    const opPush = hex.split(' ').filter((_, i, a) => i > 0 && /^OP_PUSH/.test(a[i - 1]));

    if (opPush[0]) {
      hex = opPush[0];
    }

    if (!hex) {
      return '';
    }
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return new TextDecoder('utf8').decode(Uint8Array.from(bytes));
  }
}

export default new TransactionUtils();
