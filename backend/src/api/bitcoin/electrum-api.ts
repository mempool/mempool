import config from '../../config';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import * as ElectrumClient from '@codewarriorr/electrum-client-js';
import { IBitcoinApi } from './bitcoin-api.interface';
import { IEsploraApi } from './esplora-api.interface';
import { IElectrumApi } from './electrum-api.interface';
import * as sha256 from 'crypto-js/sha256';
import * as hexEnc from 'crypto-js/enc-hex';
import BitcoinApi from './bitcoin-api';
import bitcoinBaseApi from './bitcoin-base.api';
class BitcoindElectrsApi extends BitcoinApi implements AbstractBitcoinApi {
  private electrumClient: any;

  constructor() {
    super();

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

  async $getRawTransaction(txId: string, skipConversion = false, addPrevout = false): Promise<IEsploraApi.Transaction> {
    const transaction: IBitcoinApi.Transaction = await this.electrumClient.blockchain_transaction_get(txId, true);
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

  }

  async $getAddressTransactions(address: string, lastSeenTxId: string): Promise<IEsploraApi.Transaction[]> {
    const addressInfo = await bitcoinBaseApi.$validateAddress(address);
    if (!addressInfo || !addressInfo.isvalid) {
     return [];
    }
    const history = await this.$getScriptHashHistory(addressInfo.scriptPubKey);
    const transactions: IEsploraApi.Transaction[] = [];
    for (const h of history) {
      const tx = await this.$getRawTransaction(h.tx_hash);
      if (tx) {
        transactions.push(tx);
      }
    }
    return transactions;
  }

  private $getScriptHashBalance(scriptHash: string): Promise<IElectrumApi.ScriptHashBalance> {
    return this.electrumClient.blockchain_scripthash_getBalance(this.encodeScriptHash(scriptHash));
  }

  private $getScriptHashHistory(scriptHash: string): Promise<IElectrumApi.ScriptHashHistory[]> {
    return this.electrumClient.blockchain_scripthash_getHistory(this.encodeScriptHash(scriptHash));
  }

  private encodeScriptHash(scriptPubKey: string): string {
    const addrScripthash = hexEnc.stringify(sha256(hexEnc.parse(scriptPubKey)));
    return addrScripthash.match(/.{2}/g).reverse().join('');
  }

}

export default BitcoindElectrsApi;
