import config from '../../config';
import logger from '../../logger';
import { IEsploraApi } from '../bitcoin/esplora-api.interface';
import bitcoinApi from '../bitcoin/bitcoin-api-factory';
import axios from 'axios';
import { TransactionExtended } from '../../mempool.interfaces';
import { promises as fsPromises } from 'fs';

interface WalletAddress {
  address: string;
  active: boolean;
  stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  transactions: IEsploraApi.AddressTxSummary[];
  lastSync: number;
}

interface Wallet {
  name: string;
  addresses: Record<string, WalletAddress>;
  lastPoll: number;
}

interface Treasury {
  id: number,
  name: string,
  wallet: string,
  enterprise: string,
  verifiedAddresses: string[],
  balances: { balance: number, time: number }[], // off-chain balances
}

const POLL_FREQUENCY = 5 * 60 * 1000; // 5 minutes

class WalletApi {
  private treasuries: Treasury[] = [];
  private wallets: Record<string, Wallet> = {};
  private syncing = false;
  private lastSync = 0;
  private isSaving = false;
  private cacheSchemaVersion = 1;

  private static TMP_FILE_NAME = config.MEMPOOL.CACHE_DIR + '/tmp-wallets-cache.json';
  private static FILE_NAME = config.MEMPOOL.CACHE_DIR + '/wallets-cache.json';

  constructor() {
    this.wallets = config.WALLETS.ENABLED ? (config.WALLETS.WALLETS as string[]).reduce((acc, wallet) => {
      acc[wallet] = { name: wallet, addresses: {}, lastPoll: 0 };
      return acc;
    }, {} as Record<string, Wallet>) : {};

    // Load cache on startup
    if (config.WALLETS.ENABLED) {
      void this.$loadCache();
    }
  }

  private async $loadCache(): Promise<void> {
    try {
      const cacheData = await fsPromises.readFile(WalletApi.FILE_NAME, 'utf8');
      if (!cacheData) {
        return;
      }

      const data = JSON.parse(cacheData);

      if (data.cacheSchemaVersion !== this.cacheSchemaVersion) {
        logger.notice('Wallets cache contains an outdated schema version. Clearing it.');
        return this.$wipeCache();
      }

      this.wallets = data.wallets;
      this.treasuries = data.treasuries || [];

      // Reset lastSync time to force transaction history refresh
      for (const wallet of Object.values(this.wallets)) {
        wallet.lastPoll = 0;
        for (const address of Object.values(wallet.addresses)) {
          address.lastSync = 0;
        }
      }
      logger.info('Restored wallets data from disk cache');
    } catch (e) {
      logger.warn('Failed to parse wallets cache. Skipping. Reason: ' + (e instanceof Error ? e.message : e));
    }
  }

  private async $saveCache(): Promise<void> {
    if (this.isSaving || !config.WALLETS.ENABLED) {
      return;
    }

    try {
      this.isSaving = true;
      logger.debug('Writing wallets data to disk cache...');

      const cacheData = {
        cacheSchemaVersion: this.cacheSchemaVersion,
        wallets: this.wallets,
        treasuries: this.treasuries,
      };

      await fsPromises.writeFile(
        WalletApi.TMP_FILE_NAME,
        JSON.stringify(cacheData),
        { flag: 'w' }
      );

      await fsPromises.rename(WalletApi.TMP_FILE_NAME, WalletApi.FILE_NAME);

      logger.debug('Wallets data saved to disk cache');
    } catch (e) {
      logger.warn('Error writing to wallets cache file: ' + (e instanceof Error ? e.message : e));
    } finally {
      this.isSaving = false;
    }
  }

  private async $wipeCache(): Promise<void> {
    try {
      await fsPromises.unlink(WalletApi.FILE_NAME);
    } catch (e: any) {
      if (e?.code !== 'ENOENT') {
        logger.err(`Cannot wipe wallets cache file ${WalletApi.FILE_NAME}. Exception ${JSON.stringify(e)}`);
      }
    }
  }

  public getWallet(wallet: string): Record<string, WalletAddress> | null {
    if (wallet in this.wallets) {
      return this.wallets?.[wallet]?.addresses || {};
    } else {
      return null;
    }
  }

  public getWallets(): string[] {
    return Object.keys(this.wallets);
  }

  public getTreasuries(): Treasury[] {
    return this.treasuries?.filter(treasury => !!this.wallets[treasury.wallet]) || [];
  }

  // resync wallet addresses from the services backend
  async $syncWallets(): Promise<void> {
    if (!config.WALLETS.ENABLED || this.syncing) {
      return;
    }

    this.syncing = true;

    if (config.WALLETS.AUTO && (Date.now() - this.lastSync) > POLL_FREQUENCY) {
      try {
        // update list of active wallets
        this.lastSync = Date.now();
        const response = await axios.get(config.MEMPOOL_SERVICES.API + `/wallets`);
        const walletList: string[] = response.data;
        if (walletList) {
          // create a quick lookup dictionary of active wallets
          const newWallets: Record<string, boolean> = Object.fromEntries(
            walletList.map(wallet => [wallet, true])
          );
          for (const wallet of walletList) {
            // don't overwrite existing wallets
            if (!this.wallets[wallet]) {
              this.wallets[wallet] = { name: wallet, addresses: {}, lastPoll: 0 };
            }
          }
          // remove wallets that are no longer active
          for (const wallet of Object.keys(this.wallets)) {
            if (!newWallets[wallet]) {
              delete this.wallets[wallet];
            }
          }
        }

        // update list of treasuries
        const treasuriesResponse = await axios.get(config.MEMPOOL_SERVICES.API + `/treasuries`);
        this.treasuries = treasuriesResponse.data || [];
      } catch (e) {
        logger.err(`Error updating active wallets: ${(e instanceof Error ? e.message : e)}`);
      }

      try {
        // update list of active treasuries
        this.lastSync = Date.now();
        const response = await axios.get(config.MEMPOOL_SERVICES.API + `/treasuries`);
        const treasuries: Treasury[] = response.data;
        if (treasuries) {
          this.treasuries = treasuries;
        }
      } catch (e) {
        logger.err(`Error updating active treasuries: ${(e instanceof Error ? e.message : e)}`);
      }

      // insert dummy address data to represent off-chain balance history
      for (const treasury of this.treasuries) {
        if (treasury.balances?.length) {
          if (this.wallets[treasury.wallet]) {
            this.wallets[treasury.wallet].addresses['private'] = convertBalancesToWalletAddress(treasury.wallet, treasury.balances);
          }
        }
      }
    }

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
            if (address !== 'private' && !addresses[address]) {
              delete wallet.addresses[address];
            }
          }
          wallet.lastPoll = Date.now();
          logger.debug(`Synced ${Object.keys(wallet.addresses).length} addresses for wallet ${wallet.name}`);

          // Update cache
          await this.$saveCache();
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
        const summary = await bitcoinApi.$getAddressTransactionSummary(address.address);
        const addressInfo = await bitcoinApi.$getAddress(address.address);
        const walletAddress: WalletAddress = {
          address: address.address,
          active: address.active,
          transactions: summary,
          stats: addressInfo.chain_stats,
          lastSync: Date.now(),
        };
        wallet.addresses[address.address] = walletAddress;
      } catch (e) {
        logger.err(`Error syncing wallet address ${address.address}: ${(e instanceof Error ? e.message : e)}`);
      }
    }
  }

  // check a new block for transactions that affect wallet address balances, and add relevant transactions to wallets
  processBlock(block: IEsploraApi.Block, blockTxs: TransactionExtended[]): Record<string, IEsploraApi.Transaction[]> {
    const walletTransactions: Record<string, IEsploraApi.Transaction[]> = {};
    for (const walletKey of Object.keys(this.wallets)) {
      const wallet = this.wallets[walletKey];
      walletTransactions[walletKey] = [];
      for (const tx of blockTxs) {
        const funded: Record<string, number> = {};
        const spent: Record<string, number> = {};
        const fundedCount: Record<string, number> = {};
        const spentCount: Record<string, number> = {};
        let anyMatch = false;
        for (const vin of tx.vin) {
          const address = vin.prevout?.scriptpubkey_address;
          if (address && wallet.addresses[address]) {
            anyMatch = true;
            spent[address] = (spent[address] ?? 0) + (vin.prevout?.value ?? 0);
            spentCount[address] = (spentCount[address] ?? 0) + 1;
          }
        }
        for (const vout of tx.vout) {
          const address = vout.scriptpubkey_address;
          if (address && wallet.addresses[address]) {
            anyMatch = true;
            funded[address] = (funded[address] ?? 0) + (vout.value ?? 0);
            fundedCount[address] = (fundedCount[address] ?? 0) + 1;
          }
        }
        for (const address of Object.keys({ ...funded, ...spent })) {
          // update address stats
          wallet.addresses[address].stats.tx_count++;
          wallet.addresses[address].stats.funded_txo_count += fundedCount[address] || 0;
          wallet.addresses[address].stats.spent_txo_count += spentCount[address] || 0;
          wallet.addresses[address].stats.funded_txo_sum += funded[address] || 0;
          wallet.addresses[address].stats.spent_txo_sum += spent[address] || 0;
          // add tx to summary
          const txSummary: IEsploraApi.AddressTxSummary = {
            txid: tx.txid,
            value: (funded[address] ?? 0) - (spent[address] ?? 0),
            height: block.height,
            time: block.timestamp,
          };
          wallet.addresses[address].transactions?.push(txSummary);
        }
        if (anyMatch) {
          walletTransactions[walletKey].push(tx);
        }
      }
    }
    return walletTransactions;
  }
}

function convertBalancesToWalletAddress(wallet: string, balances: { balance: number, time: number }[]): WalletAddress {
  // represent the off-chain balance as a series of transactions modifying a single notional UTXO
  const sortedBalances = balances.sort((a, b) => a.time - b.time);
  const walletAddress: WalletAddress = {
    address: 'private',
    active: false,
    stats: {
      funded_txo_count: 0,
      funded_txo_sum: sortedBalances[sortedBalances.length - 1].balance,
      spent_txo_count: 0,
      spent_txo_sum: 0,
      tx_count: 0,
    },
    transactions: [],
    lastSync: sortedBalances[sortedBalances.length - 1].time,
  };
  let lastBalance = 0;
  for (const [index, entry] of sortedBalances.entries()) {
    const diff = entry.balance - lastBalance;
    walletAddress.transactions.push({
      txid: `${wallet}-private-${index}`,
      value: diff,
      height: index,
      time: entry.time,
    });
    lastBalance = entry.balance;
  }
  return walletAddress;
}

export default new WalletApi();