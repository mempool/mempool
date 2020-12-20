import config from '../../config';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import { Transaction, Block, MempoolInfo, RpcBlock, MempoolEntries, MempoolEntry } from '../../interfaces';
import * as bitcoin from '@mempool/bitcoin';
import * as ElectrumClient from '@codewarriorr/electrum-client-js';
import logger from '../../logger';

class BitcoindElectrsApi implements AbstractBitcoinApi {
  bitcoindClient: any;
  electrumClient: any;

  constructor() {
    this.bitcoindClient = new bitcoin.Client({
      host: config.BITCOIND.HOST,
      port: config.BITCOIND.PORT,
      user: config.BITCOIND.USERNAME,
      pass: config.BITCOIND.PASSWORD,
      timeout: 60000,
    });

    this.electrumClient = new ElectrumClient(
      config.ELECTRS.HOST,
      config.ELECTRS.PORT,
      'ssl'
    );

    this.electrumClient.connect(
      'electrum-client-js',
      '1.4'
    )
  }

  getMempoolInfo(): Promise<MempoolInfo> {
    return this.bitcoindClient.getMempoolInfo();
  }

  getRawMempool(): Promise<Transaction['txid'][]> {
    return this.bitcoindClient.getRawMemPool();
  }

  getRawMempoolVerbose(): Promise<MempoolEntries> {
    return this.bitcoindClient.getRawMemPool(true);
  }

  getMempoolEntry(txid: string): Promise<MempoolEntry> {
    return this.bitcoindClient.getMempoolEntry(txid,);
  }

  async getRawTransaction(txId: string): Promise<Transaction> {
    try {
      const transaction: Transaction = await this.electrumClient.blockchain_transaction_get(txId, true);
      if (!transaction) {
        throw new Error('not found');
      }
      transaction.vout.forEach((vout) => vout.value = vout.value * 100000000);
      return transaction;
    } catch (e) {
      logger.debug('getRawTransaction error: ' + (e.message || e)); 
      throw new Error(e);
    }
  }

  getRawTransactionBitcond(txId: string): Promise<Transaction> {
    return this.bitcoindClient.getRawTransaction(txId, true)
      .then((transaction: Transaction) => {
        transaction.vout.forEach((vout) => vout.value = vout.value * 100000000);
        return transaction;
      });
  }

  getBlockHeightTip(): Promise<number> {
    return this.bitcoindClient.getChainTips()
      .then((result) => result[0].height);
  }

  getTxIdsForBlock(hash: string): Promise<string[]> {
    return this.bitcoindClient.getBlock(hash, 1)
      .then((rpcBlock: RpcBlock) => {
        return rpcBlock.tx;
      });
  }

  getBlockHash(height: number): Promise<string> {
    return this.bitcoindClient.getBlockHash(height)
  }

  getBlock(hash: string): Promise<Block> {
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
}

export default BitcoindElectrsApi;
