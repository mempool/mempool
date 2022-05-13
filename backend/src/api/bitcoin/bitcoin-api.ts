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


  $getRawTransaction(txId: string, skipConversion = false, addPrevout = false, lazyPrevouts = false): Promise<IEsploraApi.Transaction> {
    // If the transaction is in the mempool we already converted and fetched the fee. Only prevouts are missing
    const txInMempool = mempool.getMempool()[txId];
    if (txInMempool && addPrevout) {
      return this.$addPrevouts(txInMempool);
    }

    return this.bitcoindClient.getRawTransaction(txId, true)
      .then((transaction: IBitcoinApi.Transaction) => {
        if (skipConversion) {
          transaction.vout.forEach((vout) => {
            vout.value = Math.round(vout.value * 100000000);
          });
          return transaction;
        }
        return this.$convertTransaction(transaction, addPrevout, lazyPrevouts);
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
      if (tx.status && tx.status.block_height === 0) {
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

  protected async $convertTransaction(transaction: IBitcoinApi.Transaction, addPrevout: boolean, lazyPrevouts = false): Promise<IEsploraApi.Transaction> {
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
        scriptpubkey_asm: vout.scriptPubKey.asm ? this.convertScriptSigAsm(vout.scriptPubKey.hex) : '',
        scriptpubkey_type: this.translateScriptPubKeyType(vout.scriptPubKey.type),
      };
    });

    esploraTransaction.vin = transaction.vin.map((vin) => {
      return {
        is_coinbase: !!vin.coinbase,
        prevout: null,
        scriptsig: vin.scriptSig && vin.scriptSig.hex || vin.coinbase || '',
        scriptsig_asm: vin.scriptSig && this.convertScriptSigAsm(vin.scriptSig.hex) || '',
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

    if (addPrevout) {
      esploraTransaction = await this.$calculateFeeFromInputs(esploraTransaction, false, lazyPrevouts);
    } else if (!transaction.confirmations) {
      esploraTransaction = await this.$appendMempoolFeeData(esploraTransaction);
    }

    return esploraTransaction;
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
      const innerTx = await this.$getRawTransaction(vin.txid, false, false);
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


  private async $calculateFeeFromInputs(transaction: IEsploraApi.Transaction, addPrevout: boolean, lazyPrevouts: boolean): Promise<IEsploraApi.Transaction> {
    if (transaction.vin[0].is_coinbase) {
      transaction.fee = 0;
      return transaction;
    }
    let totalIn = 0;

    for (let i = 0; i < transaction.vin.length; i++) {
      if (lazyPrevouts && i > 12) {
        transaction.vin[i].lazy = true;
        continue;
      }
      const innerTx = await this.$getRawTransaction(transaction.vin[i].txid, false, false);
      if (addPrevout) {
        transaction.vin[i].prevout = innerTx.vout[transaction.vin[i].vout];
        this.addInnerScriptsToVin(transaction.vin[i]);
      }
      totalIn += innerTx.vout[transaction.vin[i].vout].value;
    }
    if (lazyPrevouts && transaction.vin.length > 12) {
      transaction.fee = -1;
    } else {
      const totalOut = transaction.vout.reduce((p, output) => p + output.value, 0);
      transaction.fee = parseFloat((totalIn - totalOut).toFixed(8));
    }
    return transaction;
  }

  private convertScriptSigAsm(hex: string): string {
    const buf = Buffer.from(hex, 'hex');

    const b: string[] = [];

    let i = 0;
    while (i < buf.length) {
      const op = buf[i];
      if (op >= 0x01 && op <= 0x4e) {
        i++;
        let push: number;
        if (op === 0x4c) {
          push = buf.readUInt8(i);
          b.push('OP_PUSHDATA1');
          i += 1;
        } else if (op === 0x4d) {
          push = buf.readUInt16LE(i);
          b.push('OP_PUSHDATA2');
          i += 2;
        } else if (op === 0x4e) {
          push = buf.readUInt32LE(i);
          b.push('OP_PUSHDATA4');
          i += 4;
        } else {
          push = op;
          b.push('OP_PUSHBYTES_' + push);
        }

        const data = buf.slice(i, i + push);
        if (data.length !== push) {
          break;
        }

        b.push(data.toString('hex'));
        i += data.length;
      } else {
        if (op === 0x00) {
          b.push('OP_0');
        } else if (op === 0x4f) {
          b.push('OP_PUSHNUM_NEG1');
        } else if (op === 0xb1) {
          b.push('OP_CLTV');
        } else if (op === 0xb2) {
          b.push('OP_CSV');
        } else if (op === 0xba) {
          b.push('OP_CHECKSIGADD');
        } else {
          const opcode = bitcoinjs.script.toASM([ op ]);
          if (opcode && op < 0xfd) {
            if (/^OP_(\d+)$/.test(opcode)) {
              b.push(opcode.replace(/^OP_(\d+)$/, 'OP_PUSHNUM_$1'));
            } else {
              b.push(opcode);
            }
          } else {
            b.push('OP_RETURN_' + op);
          }
        }
        i += 1;
      }
    }

    return b.join(' ');
  }

  private addInnerScriptsToVin(vin: IEsploraApi.Vin): void {
    if (!vin.prevout) {
      return;
    }

    if (vin.prevout.scriptpubkey_type === 'p2sh') {
      const redeemScript = vin.scriptsig_asm.split(' ').reverse()[0];
      vin.inner_redeemscript_asm = this.convertScriptSigAsm(redeemScript);
      if (vin.witness && vin.witness.length > 2) {
        const witnessScript = vin.witness[vin.witness.length - 1];
        vin.inner_witnessscript_asm = this.convertScriptSigAsm(witnessScript);
      }
    }

    if (vin.prevout.scriptpubkey_type === 'v0_p2wsh' && vin.witness) {
      const witnessScript = vin.witness[vin.witness.length - 1];
      vin.inner_witnessscript_asm = this.convertScriptSigAsm(witnessScript);
    }

    if (vin.prevout.scriptpubkey_type === 'v1_p2tr' && vin.witness && vin.witness.length > 1) {
      const witnessScript = vin.witness[vin.witness.length - 2];
      vin.inner_witnessscript_asm = this.convertScriptSigAsm(witnessScript);
    }
  }

}

export default BitcoinApi;
