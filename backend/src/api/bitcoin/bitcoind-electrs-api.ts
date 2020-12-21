import config from '../../config';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import { Transaction, Block, MempoolInfo, RpcBlock, MempoolEntries, MempoolEntry, Address,
  AddressInformation, ScriptHashBalance, ScriptHashHistory } from '../../interfaces';
import * as bitcoin from '@mempool/bitcoin';
import * as ElectrumClient from '@codewarriorr/electrum-client-js';
import logger from '../../logger';
import transactionUtils from '../transaction-utils';
import * as sha256 from 'crypto-js/sha256';
import * as hexEnc from 'crypto-js/enc-hex';
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
    );
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

  async $getRawTransaction(txId: string): Promise<Transaction> {
    try {
      const transaction: Transaction = await this.electrumClient.blockchain_transaction_get(txId, true);
      if (!transaction) {
        throw new Error(txId + ' not found!');
      }
      transactionUtils.bitcoindToElectrsTransaction(transaction);
      return transaction;
    } catch (e) {
      logger.debug('getRawTransaction error: ' + (e.message || e));
      throw new Error(e);
    }
  }

  $getRawTransactionBitcond(txId: string): Promise<Transaction> {
    return this.bitcoindClient.getRawTransaction(txId, true)
      .then((transaction: Transaction) => {
        transactionUtils.bitcoindToElectrsTransaction(transaction);
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

  async $getAddress(address: string): Promise<Address> {
    try {
      const addressInfo: Address = await this.electrumClient.blockchain_scripthash_getBalance(address);
      if (!address) {
        throw new Error('not found');
      }
      return addressInfo;
    } catch (e) {
      logger.debug('getRawTransaction error: ' + (e.message || e));
      throw new Error(e);
    }
  }

  $validateAddress(address: string): Promise<AddressInformation> {
    return this.bitcoindClient.validateAddress(address);
  }

  $getScriptHashBalance(scriptHash: string): Promise<ScriptHashBalance> {
    return this.electrumClient.blockchain_scripthash_getBalance(this.encodeScriptHash(scriptHash));
  }

  $getScriptHashHistory(scriptHash: string): Promise<ScriptHashHistory[]> {
    return this.electrumClient.blockchain_scripthash_getHistory(this.encodeScriptHash(scriptHash));
  }

  private encodeScriptHash(scriptPubKey: string): string {
    const addrScripthash = hexEnc.stringify(sha256(hexEnc.parse(scriptPubKey)));
    return addrScripthash.match(/.{2}/g).reverse().join('');
  }
}

export default BitcoindElectrsApi;
