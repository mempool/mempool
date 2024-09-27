import config from '../../config';
import logger from '../../logger';
import { IEsploraApi } from '../bitcoin/esplora-api.interface';
import bitcoinApi from '../bitcoin/bitcoin-api-factory';
import axios from 'axios';
import { TransactionExtended } from '../../mempool.interfaces';

interface WalletAddress {
  address: string;
  active: boolean;
  transactions?: IEsploraApi.AddressTxSummary[];
  lastSync: number;
}

interface Wallet {
  name: string;
  addresses: Record<string, WalletAddress>;
  lastPoll: number;
}

const POLL_FREQUENCY = 5 * 60 * 1000; // 5 minutes

class WalletApi {
  private wallets: Record<string, Wallet> = {};
  private syncing = false;

  constructor() {
    this.wallets = config.WALLETS.ENABLED ? (config.WALLETS.WALLETS as string[]).reduce((acc, wallet) => {
      acc[wallet] = { name: wallet, addresses: {}, lastPoll: 0 };
      return acc;
    }, {} as Record<string, Wallet>) : {};
  }

  public getWallet(wallet: string): Record<string, WalletAddress> {
    return this.wallets?.[wallet]?.addresses || {};
  }

  // resync wallet addresses from the services backend
  async $syncWallets(): Promise<void> {
    if (!config.WALLETS.ENABLED) {
      return;
    }
    this.syncing = true;
    for (const walletKey of Object.keys(this.wallets)) {
      const wallet = this.wallets[walletKey];
      if (wallet.lastPoll < (Date.now() - POLL_FREQUENCY)) {
        try {
          const response = await axios.get(config.MEMPOOL_SERVICES.API + `/wallets/${wallet.name}`);
          const addresses: Record<string, WalletAddress> = response.data;
          const addressList: WalletAddress[] = Object.values(addresses);
          // sync all current addresses
          for (const address of addressList) {
            await this.$syncWalletAddress(wallet, address);
          }
          // remove old addresses
          for (const address of Object.keys(wallet.addresses)) {
            if (!addresses[address]) {
              delete wallet.addresses[address];
            }
          }
          wallet.lastPoll = Date.now();
          logger.debug(`Synced ${Object.keys(wallet.addresses).length} addresses for wallet ${wallet.name}`);
        } catch (e) {
          logger.err(`Error syncing wallet ${wallet.name}: ${(e instanceof Error ? e.message : e)}`);
        }
      }
    }
    this.syncing = false;
  }

  // resync address transactions from esplora
  async $syncWalletAddress(wallet: Wallet, address: WalletAddress): Promise<void> {
    // fetch full transaction data if the address is new or still active and hasn't been synced in the last hour
    const refreshTransactions = !wallet.addresses[address.address] || (address.active && (Date.now() - wallet.addresses[address.address].lastSync) > 60 * 60 * 1000);
    if (refreshTransactions) {
      try {
        const walletAddress: WalletAddress = {
          address: address.address,
          active: address.active,
          transactions: await bitcoinApi.$getAddressTransactionSummary(address.address),
          lastSync: Date.now(),
        };
        wallet.addresses[address.address] = walletAddress;
      } catch (e) {
        logger.err(`Error syncing wallet address ${address.address}: ${(e instanceof Error ? e.message : e)}`);
      }
    }
  }

  // check a new block for transactions that affect wallet address balances, and add relevant transactions to wallets
  processBlock(block: IEsploraApi.Block, blockTxs: TransactionExtended[]): Record<string, Record<string, IEsploraApi.AddressTxSummary[]>> {
    const walletTransactions: Record<string, Record<string, IEsploraApi.AddressTxSummary[]>> = {};
    for (const walletKey of Object.keys(this.wallets)) {
      const wallet = this.wallets[walletKey];
      walletTransactions[walletKey] = {};
      for (const tx of blockTxs) {
        const funded: Record<string, number> = {};
        const spent: Record<string, number> = {};
        for (const vin of tx.vin) {
          const address = vin.prevout?.scriptpubkey_address;
          if (address && wallet.addresses[address]) {
            spent[address] = (spent[address] ?? 0) + (vin.prevout?.value ?? 0);
          }
        }
        for (const vout of tx.vout) {
          const address = vout.scriptpubkey_address;
          if (address && wallet.addresses[address]) {
            funded[address] = (funded[address] ?? 0) + (vout.value ?? 0);
          }
        }
        for (const address of Object.keys({ ...funded, ...spent })) {
          if (!walletTransactions[walletKey][address]) {
            walletTransactions[walletKey][address] = [];
          }
          walletTransactions[walletKey][address].push({
            txid: tx.txid,
            value: (funded[address] ?? 0) - (spent[address] ?? 0),
            height: block.height,
            time: block.timestamp,
          });
        }
      }
    }
    return walletTransactions;
  }
}

export default new WalletApi();