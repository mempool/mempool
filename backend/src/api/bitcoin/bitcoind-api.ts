import config from '../../config';
import { Transaction, Block, MempoolInfo, RpcBlock, MempoolEntries, MempoolEntry, Address,
    AddressInformation, ScriptHashBalance, ScriptHashHistory } from '../../interfaces';
import * as bitcoin from '@mempool/bitcoin';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';

class BitcoindApi implements AbstractBitcoinApi {
  bitcoindClient: any;

  constructor() {
    this.bitcoindClient = new bitcoin.Client({
      host: config.BITCOIND.HOST,
      port: config.BITCOIND.PORT,
      user: config.BITCOIND.USERNAME,
      pass: config.BITCOIND.PASSWORD,
      timeout: 60000,
    });
  }

  $getMempoolInfo(): Promise<MempoolInfo> {
    return this.bitcoindClient.getMempoolInfo();
  }

  $getRawMempool(): Promise<Transaction['txid'][]> {
    return this.bitcoindClient.getRawMemPool();
  }

  $getRawMempoolVerbose(): Promise<MempoolEntries> {
    return this.bitcoindClient.getRawMemPool(true);
  }

  $getMempoolEntry(txid: string): Promise<MempoolEntry> {
    return this.bitcoindClient.getMempoolEntry(txid);
  }

  $getRawTransaction(txId: string): Promise<Transaction> {
    return this.bitcoindClient.getRawTransaction(txId, true)
      .then((transaction: Transaction) => {
        transaction.vout.forEach((vout) => vout.value = vout.value * 100000000);
        return transaction;
      });
  }

  $getBlockHeightTip(): Promise<number> {
    return this.bitcoindClient.getChainTips()
      .then((result) => result[0].height);
  }

  $getTxIdsForBlock(hash: string): Promise<string[]> {
    return this.bitcoindClient.getBlock(hash, 1)
      .then((rpcBlock: RpcBlock) => {
        return rpcBlock.tx;
      });
  }

  $getBlockHash(height: number): Promise<string> {
    return this.bitcoindClient.getBlockHash(height);
  }

  $getBlock(hash: string): Promise<Block> {
    return this.bitcoindClient.getBlock(hash)
      .then((rpcBlock: RpcBlock) => {
        return {
          id: rpcBlock.hash,
          height: rpcBlock.height,
          version: rpcBlock.version,
          timestamp: rpcBlock.time,
          bits: rpcBlock.bits,
          nonce: rpcBlock.nonce,
          difficulty: rpcBlock.difficulty,
          merkle_root: rpcBlock.merkleroot,
          tx_count: rpcBlock.nTx,
          size: rpcBlock.size,
          weight: rpcBlock.weight,
          previousblockhash: rpcBlock.previousblockhash,
        };
      });
  }

  $getRawTransactionBitcond(txId: string): Promise<Transaction> {
    throw new Error('Method not implemented.');
  }

  $getAddress(address: string): Promise<Address> {
    throw new Error('Method not implemented.');
  }

  $validateAddress(address: string): Promise<AddressInformation> {
    return this.bitcoindClient.validateAddress(address);
  }

  $getScriptHashBalance(scriptHash: string): Promise<ScriptHashBalance> {
    throw new Error('Method not implemented.');
  }

  $getScriptHashHistory(scriptHash: string): Promise<ScriptHashHistory[]> {
    throw new Error('Method not implemented.');
  }
}

export default BitcoindApi;
