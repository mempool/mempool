import config from '../../config';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import { IBitcoinApi } from './bitcoin-api.interface';
import { IEsploraApi } from './esplora-api.interface';
import { IElectrumApi } from './electrum-api.interface';
import BitcoinApi from './bitcoin-api';
import bitcoinBaseApi from './bitcoin-base.api';
import mempool from '../mempool';
import logger from '../../logger';
import * as ElectrumClient from '@mempool/electrum-client';
import * as sha256 from 'crypto-js/sha256';
import * as hexEnc from 'crypto-js/enc-hex';

class BitcoindElectrsApi extends BitcoinApi implements AbstractBitcoinApi {
  private electrumClient: any;

  constructor() {
    super();

    const electrumConfig = { client: 'mempool-v2', version: '1.4' };
    const electrumPersistencePolicy = { retryPeriod: 10000, maxRetry: 1000, callback: null };

    const electrumCallbacks = {
      onConnect: (client, versionInfo) => { logger.info(`Connected to Electrum Server at ${config.ELECTRUM.HOST}:${config.ELECTRUM.PORT} (${JSON.stringify(versionInfo)})`); },
      onClose: (client) => { logger.info(`Disconnected from Electrum Server at ${config.ELECTRUM.HOST}:${config.ELECTRUM.PORT}`); },
      onError: (err) => { logger.err(`Electrum error: ${JSON.stringify(err)}`); },
      onLog: (str) => { logger.debug(str); },
    };

    this.electrumClient = new ElectrumClient(
      config.ELECTRUM.PORT,
      config.ELECTRUM.HOST,
      config.ELECTRUM.PROTOCOL,
      null,
      electrumCallbacks
    );

    this.electrumClient.initElectrum(electrumConfig, electrumPersistencePolicy)
      .then(() => {})
      .catch((err) => {
        logger.err(`Error connecting to Electrum Server at ${config.ELECTRUM.HOST}:${config.ELECTRUM.PORT}`);
      });
  }

  async $getRawTransaction(txId: string, skipConversion = false, addPrevout = false): Promise<IEsploraApi.Transaction> {
    if (!config.ELECTRUM.TX_LOOKUPS) {
      return super.$getRawTransaction(txId, skipConversion, addPrevout);
    }
    const txInMempool = mempool.getMempool()[txId];
    if (txInMempool && addPrevout) {
      return this.$addPrevouts(txInMempool);
    }
    const transaction: IBitcoinApi.Transaction = await this.electrumClient.blockchainTransaction_get(txId, true);
    if (!transaction) {
      throw new Error('Unable to get transaction: ' + txId);
    }
    if (skipConversion) {
      // @ts-ignore
      return transaction;
    }
    return this.$convertTransaction(transaction, addPrevout);
  }

  async $getAddress(address: string): Promise<IEsploraApi.Address> {
    const addressInfo = await bitcoinBaseApi.$validateAddress(address);
    if (!addressInfo || !addressInfo.isvalid) {
      return ({
        'address': address,
        'chain_stats': {
          'funded_txo_count': 0,
          'funded_txo_sum': 0,
          'spent_txo_count': 0,
          'spent_txo_sum': 0,
          'tx_count': 0
        },
        'mempool_stats': {
          'funded_txo_count': 0,
          'funded_txo_sum': 0,
          'spent_txo_count': 0,
          'spent_txo_sum': 0,
          'tx_count': 0
        }
      });
    }

    try {
      const balance = await this.$getScriptHashBalance(addressInfo.scriptPubKey);
      const history = await this.$getScriptHashHistory(addressInfo.scriptPubKey);

      const unconfirmed = history.filter((h) => h.fee).length;

      return {
        'address': addressInfo.address,
        'chain_stats': {
          'funded_txo_count': 0,
          'funded_txo_sum': balance.confirmed ? balance.confirmed : 0,
          'spent_txo_count': 0,
          'spent_txo_sum': balance.confirmed < 0 ? balance.confirmed : 0,
          'tx_count': history.length - unconfirmed,
        },
        'mempool_stats': {
          'funded_txo_count': 0,
          'funded_txo_sum': balance.unconfirmed > 0 ? balance.unconfirmed : 0,
          'spent_txo_count': 0,
          'spent_txo_sum': balance.unconfirmed < 0 ? -balance.unconfirmed : 0,
          'tx_count': unconfirmed,
        }
      };
    } catch (e) {
      if (e === 'failed to get confirmed status') {
        e = 'The number of transactions on this address exceeds the Electrum server limit';
      }
      throw new Error(e);
    }
  }

  async $getAddressTransactions(address: string, lastSeenTxId: string): Promise<IEsploraApi.Transaction[]> {
    const addressInfo = await bitcoinBaseApi.$validateAddress(address);
    if (!addressInfo || !addressInfo.isvalid) {
     return [];
    }

    try {
      const transactions: IEsploraApi.Transaction[] = [];
      const history = await this.$getScriptHashHistory(addressInfo.scriptPubKey);
      history.reverse();

      let startingIndex = 0;
      if (lastSeenTxId) {
        const pos = history.findIndex((historicalTx) => historicalTx.tx_hash === lastSeenTxId);
        if (pos) {
          startingIndex = pos + 1;
        }
      }

      for (let i = startingIndex; i < Math.min(startingIndex + 10, history.length); i++) {
        const tx = await this.$getRawTransaction(history[i].tx_hash, false, true);
        if (tx) {
          transactions.push(tx);
        }
      }

      return transactions;
    } catch (e) {
      if (e === 'failed to get confirmed status') {
        e = 'The number of transactions on this address exceeds the Electrum server limit';
      }
      throw new Error(e);
    }
  }

  private $getScriptHashBalance(scriptHash: string): Promise<IElectrumApi.ScriptHashBalance> {
    return this.electrumClient.blockchainScripthash_getBalance(this.encodeScriptHash(scriptHash));
  }

  private $getScriptHashHistory(scriptHash: string): Promise<IElectrumApi.ScriptHashHistory[]> {
    return this.electrumClient.blockchainScripthash_getHistory(this.encodeScriptHash(scriptHash));
  }

  private encodeScriptHash(scriptPubKey: string): string {
    const addrScripthash = hexEnc.stringify(sha256(hexEnc.parse(scriptPubKey)));
    return addrScripthash.match(/.{2}/g).reverse().join('');
  }

}

export default BitcoindElectrsApi;
