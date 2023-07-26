import { TransactionExtended, MempoolTransactionExtended, TransactionMinerInfo } from '../mempool.interfaces';
import { IEsploraApi } from './bitcoin/esplora-api.interface';
import { Common } from './common';
import bitcoinApi, { bitcoinCoreApi } from './bitcoin/bitcoin-api-factory';
import * as bitcoinjs from 'bitcoinjs-lib';
import crypto from 'node:crypto';

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
  public async $getTransactionExtended(txId: string, addPrevouts = false, lazyPrevouts = false, forceCore = false, addMempoolData = false): Promise<TransactionExtended> {
    let transaction: IEsploraApi.Transaction;
    if (forceCore === true) {
      transaction  = await bitcoinCoreApi.$getRawTransaction(txId, true);
    } else {
      transaction  = await bitcoinApi.$getRawTransaction(txId, false, addPrevouts, lazyPrevouts);
    }

    if (Common.isLiquid()) {
      if (!isFinite(Number(transaction.fee))) {
        transaction.fee = Object.values(transaction.fee || {}).reduce((total, output) => total + output, 0);
      }
    }

    if (addMempoolData || !transaction?.status?.confirmed) {
      return this.extendMempoolTransaction(transaction);
    } else {
      return this.extendTransaction(transaction);
    }
  }

  public async $getMempoolTransactionExtended(txId: string, addPrevouts = false, lazyPrevouts = false, forceCore = false): Promise<MempoolTransactionExtended> {
    return (await this.$getTransactionExtended(txId, addPrevouts, lazyPrevouts, forceCore, true)) as MempoolTransactionExtended;
  }

  public extendTransaction(transaction: IEsploraApi.Transaction): TransactionExtended {
    // @ts-ignore
    if (transaction.vsize) {
      // @ts-ignore
      return transaction;
    }
    const feePerVbytes = (transaction.fee || 0) / (transaction.weight / 4);
    const transactionExtended: TransactionExtended = Object.assign({
      vsize: Math.round(transaction.weight / 4),
      feePerVsize: feePerVbytes,
      effectiveFeePerVsize: feePerVbytes,
    }, transaction);
    if (!transaction?.status?.confirmed && !transactionExtended.firstSeen) {
      transactionExtended.firstSeen = Math.round((Date.now() / 1000));
    }
    return transactionExtended;
  }

  public extendMempoolTransaction(transaction: IEsploraApi.Transaction): MempoolTransactionExtended {
    const vsize = Math.ceil(transaction.weight / 4);
    const fractionalVsize = (transaction.weight / 4);
    const sigops = !Common.isLiquid() ? this.countSigops(transaction) : 0;
    // https://github.com/bitcoin/bitcoin/blob/e9262ea32a6e1d364fb7974844fadc36f931f8c6/src/policy/policy.cpp#L295-L298
    const adjustedVsize = Math.max(fractionalVsize, sigops *  5); // adjusted vsize = Max(weight, sigops * bytes_per_sigop) / witness_scale_factor
    const feePerVbytes = (transaction.fee || 0) / fractionalVsize;
    const adjustedFeePerVsize = (transaction.fee || 0) / adjustedVsize;
    const transactionExtended: MempoolTransactionExtended = Object.assign(transaction, {
      order: this.txidToOrdering(transaction.txid),
      vsize: Math.round(transaction.weight / 4),
      adjustedVsize,
      sigops,
      feePerVsize: feePerVbytes,
      adjustedFeePerVsize: adjustedFeePerVsize,
      effectiveFeePerVsize: adjustedFeePerVsize,
    });
    if (!transactionExtended?.status?.confirmed && !transactionExtended.firstSeen) {
      transactionExtended.firstSeen = Math.round((Date.now() / 1000));
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

  public countScriptSigops(script: string, isRawScript: boolean = false, witness: boolean = false): number {
    let sigops = 0;
    // count OP_CHECKSIG and OP_CHECKSIGVERIFY
    sigops += (script.match(/OP_CHECKSIG/g)?.length || 0);

    // count OP_CHECKMULTISIG and OP_CHECKMULTISIGVERIFY
    if (isRawScript) {
      // in scriptPubKey or scriptSig, always worth 20
      sigops += 20 * (script.match(/OP_CHECKMULTISIG/g)?.length || 0);
    } else {
      // in redeem scripts and witnesses, worth N if preceded by OP_N, 20 otherwise
      const matches = script.matchAll(/(?:OP_(\d+))? OP_CHECKMULTISIG/g);
      for (const match of matches) {
        const n = parseInt(match[1]);
        if (Number.isInteger(n)) {
          sigops += n;
        } else {
          sigops += 20;
        }
      }
    }

    return witness ? sigops : (sigops * 4);
  }

  public countSigops(transaction: IEsploraApi.Transaction): number {
    let sigops = 0;

    for (const input of transaction.vin) {
      if (input.scriptsig_asm) {
        sigops += this.countScriptSigops(input.scriptsig_asm, true);
      }
      if (input.prevout) {
        switch (true) {
          case input.prevout.scriptpubkey_type === 'p2sh' && input.witness?.length === 2 && input.scriptsig && input.scriptsig.startsWith('160014'):
          case input.prevout.scriptpubkey_type === 'v0_p2wpkh':
            sigops += 1;
            break;

          case input.prevout?.scriptpubkey_type === 'p2sh' && input.witness?.length && input.scriptsig && input.scriptsig.startsWith('220020'):
          case input.prevout.scriptpubkey_type === 'v0_p2wsh':
            if (input.witness?.length) {
              sigops += this.countScriptSigops(bitcoinjs.script.toASM(Buffer.from(input.witness[input.witness.length - 1], 'hex')), false, true);
            }
            break;
        }
      }
    }

    for (const output of transaction.vout) {
      if (output.scriptpubkey_asm) {
        sigops += this.countScriptSigops(output.scriptpubkey_asm, true);
      }
    }

    return sigops;
  }

  // returns the most significant 4 bytes of the txid as an integer
  public txidToOrdering(txid: string): number {
    return parseInt(
      txid.substr(62, 2) +
        txid.substr(60, 2) +
        txid.substr(58, 2) +
        txid.substr(56, 2),
      16
    );
  }

  public calcScriptHash(script: string): string {
    if (!/^[0-9a-fA-F]*$/.test(script) || script.length % 2 !== 0) {
      throw new Error('script is not a valid hex string');
    }
    const buf = Buffer.from(script, 'hex');
    return crypto.createHash('sha256').update(buf).digest('hex');
  }
}

export default new TransactionUtils();
