import bitcoinApi from './bitcoin/bitcoin-api-factory';
import { MempoolEntries, MempoolEntry, Transaction, TransactionExtended, TransactionMinerInfo } from '../interfaces';
import config from '../config';
import logger from '../logger';
import mempool from './mempool';
import blocks from './blocks';

class TransactionUtils {
  private mempoolEntriesCache: MempoolEntries | null = null;

  constructor() { }

  public async $addPrevoutsToTransaction(transaction: TransactionExtended): Promise<TransactionExtended> {
    for (const vin of transaction.vin) {
      const innerTx = await bitcoinApi.$getRawTransaction(vin.txid);
      vin.prevout = innerTx.vout[vin.vout];
    }
    return transaction;
  }

  public async $calculateFeeFromInputs(transaction: Transaction): Promise<TransactionExtended> {
    if (transaction.vin[0]['coinbase']) {
      transaction.fee = 0;
      // @ts-ignore
      return transaction;
    }
    let totalIn = 0;
    for (const vin of transaction.vin) {
      const innerTx = await bitcoinApi.$getRawTransaction(vin.txid);
      totalIn += innerTx.vout[vin.vout].value;
    }
    const totalOut = transaction.vout.reduce((prev, output) => prev + output.value, 0);
    transaction.fee = parseFloat((totalIn - totalOut).toFixed(8));
    return this.extendTransaction(transaction);
  }

  public extendTransaction(transaction: Transaction): TransactionExtended {
    transaction['vsize'] = Math.round(transaction.weight / 4);
    transaction['feePerVsize'] = Math.max(1, (transaction.fee || 0) / (transaction.weight / 4));
    if (!transaction.in_active_chain) {
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

  public async getTransactionExtended(txId: string, isCoinbase = false, inMempool = false): Promise<TransactionExtended | null> {
    try {
      let transaction: Transaction;
      if (inMempool) {
        transaction = await bitcoinApi.$getRawTransactionBitcond(txId);
      } else {
        transaction = await bitcoinApi.$getRawTransaction(txId);
      }
      if (config.MEMPOOL.BACKEND !== 'electrs' && !isCoinbase) {
        if (inMempool) {
          transaction = await this.$appendFeeData(transaction);
        } else {
          transaction = await this.$calculateFeeFromInputs(transaction);
        }
      }
      return this.extendTransaction(transaction);
    } catch (e) {
      logger.debug('getTransactionExtended error: ' + (e.message || e));
      console.log(e);
      return null;
    }
  }

  public bitcoindToElectrsTransaction(transaction: any): void {
    try {
      transaction.vout = transaction.vout.map((vout) => {
        return {
          value: vout.value * 100000000,
          scriptpubkey: vout.scriptPubKey.hex,
          scriptpubkey_address: vout.scriptPubKey && vout.scriptPubKey.addresses ? vout.scriptPubKey.addresses[0] : null,
          scriptpubkey_asm: vout.scriptPubKey.asm,
          scriptpubkey_type: this.translateScriptPubKeyType(vout.scriptPubKey.type),
        };
      });
      if (transaction.confirmations) {
        transaction['status'] = {
          confirmed: true,
          block_height: blocks.getCurrentBlockHeight() - transaction.confirmations,
          block_hash: transaction.blockhash,
          block_time: transaction.blocktime,
        };
      } else {
        transaction['status'] = { confirmed: false };
      }
    } catch (e) {
      console.log('augment failed: ' + (e.message || e));
    }
  }

  private translateScriptPubKeyType(outputType: string): string {
    const map = {
      'pubkey': 'p2pk',
      'pubkeyhash': 'p2pkh',
      'scripthash': 'p2sh',
      'witness_v0_keyhash': 'v0_p2wpkh',
      'witness_v0_scripthash': 'v0_p2wsh',
      'witness_v1_taproot': 'v1_p2tr',
      'nonstandard': 'nonstandard',
      'nulldata': 'nulldata'
    };

    if (map[outputType]) {
      return map[outputType];
    } else {
      return '';
    }
  }

  private async $appendFeeData(transaction: Transaction): Promise<Transaction> {
    let mempoolEntry: MempoolEntry;
    if (!mempool.isInSync() && !this.mempoolEntriesCache) {
      this.mempoolEntriesCache = await bitcoinApi.$getRawMempoolVerbose();
    }
    if (this.mempoolEntriesCache && this.mempoolEntriesCache[transaction.txid]) {
      mempoolEntry = this.mempoolEntriesCache[transaction.txid];
    } else {
      mempoolEntry = await bitcoinApi.$getMempoolEntry(transaction.txid);
    }
    transaction.fee = mempoolEntry.fees.base * 100000000;
    return transaction;
  }
}

export default new TransactionUtils();
