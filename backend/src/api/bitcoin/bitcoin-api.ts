import * as bitcoinjs from 'bitcoinjs-lib';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import { IBitcoinApi } from './bitcoin-api.interface';
import { IEsploraApi } from './esplora-api.interface';
import blocks from '../blocks';
import mempool from '../mempool';
import { TransactionExtended } from '../../mempool.interfaces';

class BitcoinApi implements AbstractBitcoinApi {
  private rawMempoolCache: IBitcoinApi.RawMempool | null = null;
  protected bitcoindClient: any;

  constructor(bitcoinClient: any) {
    this.bitcoindClient = bitcoinClient;
  }

  $getRawTransaction(txId: string, skipConversion = false, addPrevout = false, blockHash?: string): Promise<IEsploraApi.Transaction> {
    // If the transaction is in the mempool we already converted and fetched the fee. Only prevouts are missing
    const txInMempool = mempool.getMempool()[txId];
    if (txInMempool && addPrevout) {
      return this.$addPrevouts(txInMempool);
    }

    return this.bitcoindClient.getRawTransaction(txId, true, blockHash)
      .then((transaction: IBitcoinApi.Transaction) => {
        if (skipConversion) {
          transaction.vout.forEach((vout) => {
            vout.value = Math.round(vout.value * 100000000);
          });
          return transaction;
        }
        return this.$convertTransaction(transaction, addPrevout);
      })
      .catch((e: Error) => {
        if (e.message.startsWith('The genesis block coinbase')) {
          return this.$returnCoinbaseTransaction();
        }
        throw e;
      });
  }

  $getBlockHeightTip(): Promise<number> {
    return this.bitcoindClient.getChainTips()
      .then((result: IBitcoinApi.ChainTips[]) => {
        return result.find(tip => tip.status === 'active')!.height;
      });
  }

  $getTxIdsForBlock(hash: string): Promise<string[]> {
    return this.bitcoindClient.getBlock(hash, 1)
      .then((rpcBlock: IBitcoinApi.Block) => rpcBlock.tx);
  }

  $getRawBlock(hash: string): Promise<string> {
    return this.bitcoindClient.getBlock(hash, 0);
  }

  $getBlockHash(height: number): Promise<string> {
    return this.bitcoindClient.getBlockHash(height);
  }

  $getBlockHeader(hash: string): Promise<string> {
    return this.bitcoindClient.getBlockHeader(hash, false);
  }

  async $getBlock(hash: string): Promise<IEsploraApi.Block> {
    const foundBlock = blocks.getBlocks().find((block) => block.id === hash);
    if (foundBlock) {
      return foundBlock;
    }

    return this.bitcoindClient.getBlock(hash)
      .then((block: IBitcoinApi.Block) => BitcoinApi.convertBlock(block));
  }

  $getAddress(address: string): Promise<IEsploraApi.Address> {
    throw new Error('Method getAddress not supported by the Bitcoin RPC API.');
  }

  $getAddressTransactions(address: string, lastSeenTxId: string): Promise<IEsploraApi.Transaction[]> {
    throw new Error('Method getAddressTransactions not supported by the Bitcoin RPC API.');
  }

  $getRawMempool(): Promise<IEsploraApi.Transaction['txid'][]> {
    return this.bitcoindClient.getRawMemPool();
  }

  $getAddressPrefix(prefix: string): string[] {
    const found: { [address: string]: string } = {};
    const mp = mempool.getMempool();
    for (const tx in mp) {
      for (const vout of mp[tx].vout) {
        if (vout.scriptpubkey_address.indexOf(prefix) === 0) {
          found[vout.scriptpubkey_address] = '';
          if (Object.keys(found).length >= 10) {
            return Object.keys(found);
          }
        }
      }
    }
    return Object.keys(found);
  }

  $sendRawTransaction(rawTransaction: string): Promise<string> {
    return this.bitcoindClient.sendRawTransaction(rawTransaction);
  }

  async $getOutspends(txId: string): Promise<IEsploraApi.Outspend[]> {
    const outSpends: IEsploraApi.Outspend[] = [];
    const tx = await this.$getRawTransaction(txId, true, false);
    for (let i = 0; i < tx.vout.length; i++) {
      if (tx.status && tx.status.block_height == 0) {
        outSpends.push({
          spent: false
        });
      } else {
        const txOut = await this.bitcoindClient.getTxOut(txId, i);
        outSpends.push({
          spent: txOut === null,
        });
      }
    }
    return outSpends;
  }

  $getEstimatedHashrate(blockHeight: number): Promise<number> {
    // 120 is the default block span in Core
    return this.bitcoindClient.getNetworkHashPs(120, blockHeight);
  }

  protected async $convertTransaction(transaction: IBitcoinApi.Transaction, addPrevout: boolean): Promise<IEsploraApi.Transaction> {
    let esploraTransaction: IEsploraApi.Transaction = {
      txid: transaction.txid,
      version: transaction.version,
      locktime: transaction.locktime,
      size: transaction.size,
      weight: transaction.weight,
      fee: 0,
      vin: [],
      vout: [],
      status: { confirmed: false },
    };

    esploraTransaction.vout = transaction.vout.map((vout) => {
      return {
        value: Math.round(vout.value * 100000000),
        scriptpubkey: vout.scriptPubKey.hex,
        scriptpubkey_address: vout.scriptPubKey && vout.scriptPubKey.address ? vout.scriptPubKey.address
          : vout.scriptPubKey.addresses ? vout.scriptPubKey.addresses[0] : '',
        scriptpubkey_asm: vout.scriptPubKey.asm ? this.convertScriptSigAsm(vout.scriptPubKey.asm) : '',
        scriptpubkey_type: this.translateScriptPubKeyType(vout.scriptPubKey.type),
      };
    });

    esploraTransaction.vin = transaction.vin.map((vin) => {
      return {
        is_coinbase: !!vin.coinbase,
        prevout: null,
        scriptsig: vin.scriptSig && vin.scriptSig.hex || vin.coinbase || '',
        scriptsig_asm: vin.scriptSig && this.convertScriptSigAsm(vin.scriptSig.asm) || '',
        sequence: vin.sequence,
        txid: vin.txid || '',
        vout: vin.vout || 0,
        witness: vin.txinwitness,
      };
    });

    if (transaction.confirmations) {
      esploraTransaction.status = {
        confirmed: true,
        block_height: blocks.getCurrentBlockHeight() - transaction.confirmations + 1,
        block_hash: transaction.blockhash,
        block_time: transaction.blocktime,
      };
    }

    if (transaction.confirmations) {
      esploraTransaction = await this.$calculateFeeFromInputs(esploraTransaction, addPrevout);
    } else {
      esploraTransaction = await this.$appendMempoolFeeData(esploraTransaction);
      if (addPrevout) {
        esploraTransaction = await this.$calculateFeeFromInputs(esploraTransaction, addPrevout);
      }
    }

    return esploraTransaction;
  }

  static convertBlock(block: IBitcoinApi.Block): IEsploraApi.Block {
    return {
      id: block.hash,
      height: block.height,
      version: block.version,
      timestamp: block.time,
      bits: parseInt(block.bits, 16),
      nonce: block.nonce,
      difficulty: block.difficulty,
      merkle_root: block.merkleroot,
      tx_count: block.nTx,
      size: block.size,
      weight: block.weight,
      previousblockhash: block.previousblockhash,
    };
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
      'multisig': 'multisig',
      'nulldata': 'op_return'
    };

    if (map[outputType]) {
      return map[outputType];
    } else {
      return 'unknown';
    }
  }

  private async $appendMempoolFeeData(transaction: IEsploraApi.Transaction): Promise<IEsploraApi.Transaction> {
    if (transaction.fee) {
      return transaction;
    }
    let mempoolEntry: IBitcoinApi.MempoolEntry;
    if (!mempool.isInSync() && !this.rawMempoolCache) {
      this.rawMempoolCache = await this.$getRawMempoolVerbose();
    }
    if (this.rawMempoolCache && this.rawMempoolCache[transaction.txid]) {
      mempoolEntry = this.rawMempoolCache[transaction.txid];
    } else {
      mempoolEntry = await this.$getMempoolEntry(transaction.txid);
    }
    transaction.fee = Math.round(mempoolEntry.fees.base * 100000000);
    return transaction;
  }

  protected async $addPrevouts(transaction: TransactionExtended): Promise<TransactionExtended> {
    for (const vin of transaction.vin) {
      if (vin.prevout) {
        continue;
      }
      const innerTx = await this.$getRawTransaction(vin.txid, false);
      vin.prevout = innerTx.vout[vin.vout];
      this.addInnerScriptsToVin(vin);
    }
    return transaction;
  }

  protected $returnCoinbaseTransaction(): Promise<IEsploraApi.Transaction> {
    return this.bitcoindClient.getBlockHash(0).then((hash: string) =>
      this.bitcoindClient.getBlock(hash, 2)
        .then((block: IBitcoinApi.Block) => {
          return this.$convertTransaction(Object.assign(block.tx[0], {
            confirmations: blocks.getCurrentBlockHeight() + 1,
            blocktime: block.time }), false);
        })
    );
  }

  private $getMempoolEntry(txid: string): Promise<IBitcoinApi.MempoolEntry> {
    return this.bitcoindClient.getMempoolEntry(txid);
  }

  private $getRawMempoolVerbose(): Promise<IBitcoinApi.RawMempool> {
    return this.bitcoindClient.getRawMemPool(true);
  }

  private async $calculateFeeFromInputs(transaction: IEsploraApi.Transaction, addPrevout: boolean): Promise<IEsploraApi.Transaction> {
    if (transaction.vin[0].is_coinbase) {
      transaction.fee = 0;
      return transaction;
    }
    let totalIn = 0;
    for (const vin of transaction.vin) {
      const innerTx = await this.$getRawTransaction(vin.txid, !addPrevout);
      if (addPrevout) {
        vin.prevout = innerTx.vout[vin.vout];
        this.addInnerScriptsToVin(vin);
      }
      totalIn += innerTx.vout[vin.vout].value;
    }
    const totalOut = transaction.vout.reduce((p, output) => p + output.value, 0);
    transaction.fee = parseFloat((totalIn - totalOut).toFixed(8));
    return transaction;
  }

  private convertScriptSigAsm(str: string): string {
    const a = str.split(' ');
    const b: string[] = [];
    a.forEach((chunk) => {
      if (chunk.substr(0, 3) === 'OP_') {
        chunk = chunk.replace(/^OP_(\d+)$/, 'OP_PUSHNUM_$1');
        chunk = chunk.replace('OP_CHECKSEQUENCEVERIFY', 'OP_CSV');
        chunk = chunk.replace('OP_CHECKLOCKTIMEVERIFY', 'OP_CLTV');
        b.push(chunk);
      } else {
        chunk = chunk.replace('[ALL]', '01');
        if (chunk === '0') {
          b.push('OP_0');
        } else if (chunk.match(/^[^0]\d*$/)) {
          const chunkInt = parseInt(chunk, 10);
          if (chunkInt < 0) {
            b.push('OP_PUSHNUM_NEG' + -chunkInt);
          } else {
            b.push('OP_PUSHNUM_' + chunk);
          }
        } else {
          const dataLength = Math.round(chunk.length / 2);
          if (dataLength > 255) {
            b.push('OP_PUSHDATA2' + ' ' + chunk);
          } else if (dataLength > 75) {
            b.push('OP_PUSHDATA1' + ' ' + chunk);
          } else {
            b.push('OP_PUSHBYTES_' + dataLength + ' ' + chunk);
          }
        }
      }
    });
    return b.join(' ');
  }

  private addInnerScriptsToVin(vin: IEsploraApi.Vin): void {
    if (!vin.prevout) {
      return;
    }

    if (vin.prevout.scriptpubkey_type === 'p2sh') {
      const redeemScript = vin.scriptsig_asm.split(' ').reverse()[0];
      vin.inner_redeemscript_asm = this.convertScriptSigAsm(bitcoinjs.script.toASM(Buffer.from(redeemScript, 'hex')));
      if (vin.witness && vin.witness.length > 2) {
        const witnessScript = vin.witness[vin.witness.length - 1];
        vin.inner_witnessscript_asm = this.convertScriptSigAsm(bitcoinjs.script.toASM(Buffer.from(witnessScript, 'hex')));
      }
    }

    if (vin.prevout.scriptpubkey_type === 'v0_p2wsh' && vin.witness) {
      const witnessScript = vin.witness[vin.witness.length - 1];
      vin.inner_witnessscript_asm = this.convertScriptSigAsm(bitcoinjs.script.toASM(Buffer.from(witnessScript, 'hex')));
    }

    if (vin.prevout.scriptpubkey_type === 'v1_p2tr' && vin.witness && vin.witness.length > 1) {
      const witnessScript = vin.witness[vin.witness.length - 2];
      vin.inner_witnessscript_asm = this.convertScriptSigAsm(bitcoinjs.script.toASM(Buffer.from(witnessScript, 'hex')));
    }
  }

}

export default BitcoinApi;
