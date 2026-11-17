// UTXOs are computed from the transaction history rather than fetched per address.

import { AddressTxSummary, Transaction } from '@interfaces/electrs.interface';
import { describeScriptType } from '@app/watch/watch-key.utils';
import { Chain, DerivedAddress, DescriptorWallet, WalletBalance, WalletUtxo, WatchWallet } from '@app/watch/watch.types';

export type AddressMap = Map<string, DerivedAddress>;

export function addressMapOf(wallet: WatchWallet): AddressMap {
  return new Map(wallet.addresses.map((a) => [a.address, a]));
}

/** Unconfirmed transactions first, then confirmed ones from the newest block down. */
export function sortNewestFirst(txs: Transaction[]): Transaction[] {
  const height = (tx: Transaction): number => (tx.status?.confirmed ? tx.status.block_height : Number.MAX_SAFE_INTEGER);
  return [...txs].sort((a, b) => height(b) - height(a));
}

function computeUtxos(txs: Transaction[], addressMap: AddressMap): WalletUtxo[] {
  const outputs = new Map<string, WalletUtxo>();
  const spent = new Set<string>();

  for (const tx of txs) {
    for (const vin of tx.vin || []) {
      // Use the outpoint: an input's prevout can be missing.
      spent.add(`${vin.txid}:${vin.vout}`);
    }
    (tx.vout || []).forEach((vout, index) => {
      const addr = vout.scriptpubkey_address;
      if (addr && addressMap.has(addr)) {
        outputs.set(`${tx.txid}:${index}`, {
          txid: tx.txid,
          vout: index,
          value: vout.value,
          address: addr,
          confirmed: !!tx.status?.confirmed,
          blockHeight: tx.status?.block_height,
        });
      }
    });
  }

  const utxos: WalletUtxo[] = [];
  for (const [outpoint, utxo] of outputs) {
    if (!spent.has(outpoint)) {
      utxos.push(utxo);
    }
  }
  return utxos.sort((a, b) => (b.blockHeight ?? Infinity) - (a.blockHeight ?? Infinity));
}

/** Net effect of one transaction on the wallet, in sats; a payment's fee is included. */
export function netValue(tx: Transaction, addressMap: AddressMap): number {
  let received = 0;
  let sent = 0;
  for (const vin of tx.vin || []) {
    const addr = vin.prevout?.scriptpubkey_address;
    if (addr && addressMap.has(addr)) {
      sent += vin.prevout.value || 0;
    }
  }
  for (const vout of tx.vout || []) {
    const addr = vout.scriptpubkey_address;
    if (addr && addressMap.has(addr)) {
      received += vout.value || 0;
    }
  }
  return received - sent;
}

function computeBalance(txs: Transaction[], addressMap: AddressMap): WalletBalance {
  // From confirmed transactions only: an unconfirmed spend already counts in `pending`.
  const confirmed = computeUtxos(txs.filter((tx) => tx.status?.confirmed), addressMap)
    .reduce((sum, u) => sum + u.value, 0);

  const pending = txs
    .filter((tx) => !tx.status?.confirmed)
    .reduce((sum, tx) => sum + netValue(tx, addressMap), 0);

  return { confirmed, pending, total: confirmed + pending };
}

/** The addresses a transaction pays to, and those it spends from where the input has a prevout. */
export function txAddresses(tx: Transaction): string[] {
  const spent = (tx.vin || []).map((vin) => vin.prevout?.scriptpubkey_address);
  const paid = (tx.vout || []).map((vout) => vout.scriptpubkey_address);
  return [...spent, ...paid].filter((address): address is string => !!address);
}

/** The wallet's addresses that appear in `txs`, and the highest index used on each chain (-1 if none). */
export function computeUsage(txs: Transaction[], addressMap: AddressMap): { used: Set<string>; lastUsed: Record<Chain, number> } {
  const used = new Set<string>();
  const lastUsed: Record<Chain, number> = { 0: -1, 1: -1 };
  for (const tx of txs) {
    for (const address of txAddresses(tx)) {
      const derived = addressMap.get(address);
      if (derived) {
        used.add(address);
        lastUsed[derived.chain] = Math.max(lastUsed[derived.chain], derived.index);
      }
    }
  }
  return { used, lastUsed };
}

function balanceHistory(txs: Transaction[], addressMap: AddressMap): AddressTxSummary[] {
  return txs
    .filter((tx) => tx.status?.confirmed)
    .map((tx) => ({
      txid: tx.txid,
      value: netValue(tx, addressMap),
      height: tx.status.block_height,
      time: tx.status.block_time,
    }))
    .sort((a, b) => b.height - a.height);
}

export interface WalletView {
  wallet: WatchWallet;
  transactions: Transaction[];
  utxos: WalletUtxo[];
  balance: WalletBalance;
  lastUsed: Record<Chain, number>;
  used: Set<string>;
  history: AddressTxSummary[];
  /** The scan hit its page limit, so the history is incomplete. */
  truncated: boolean;
}

export function buildWalletView(wallet: WatchWallet, transactions: Transaction[], truncated: boolean): WalletView {
  const map = addressMapOf(wallet);
  return {
    wallet,
    transactions,
    utxos: computeUtxos(transactions, map),
    balance: computeBalance(transactions, map),
    ...computeUsage(transactions, map),
    history: balanceHistory(transactions, map),
    truncated,
  };
}

/** The key origin's path, `m` for a master key, else the standard one for single-key script types. */
export function accountPath(wallet: WatchWallet): string | undefined {
  if (wallet.kind === 'address-list' || wallet.multisig) {
    return undefined;
  }
  if (wallet.originPath) {
    return wallet.originPath;
  }
  if (wallet.fingerprintIsMaster) {
    return 'm';
  }
  const standard = describeScriptType(wallet.scriptType).path;
  // The standard paths are written for mainnet; test networks use coin type 1 (SLIP-44).
  return standard && wallet.network !== 'mainnet' ? standard.replace(/^(m\/\d+')\/0'/, '$1/1\'') : standard;
}

export function derivationPath(wallet: WatchWallet, derived: DerivedAddress): string {
  if (wallet.kind === 'address-list') {
    return '';
  }
  const account = accountPath(wallet);
  return account ? `${account}/${derived.chain}/${derived.index}` : `${derived.chain}/${derived.index}`;
}

export function currentReceiveIndex(wallet: DescriptorWallet, lastUsed: Record<Chain, number>): number {
  return Math.max(lastUsed[0] + 1, wallet.receiveIndex ?? 0);
}

/** For an address list, the unused addresses in list order. */
export function upcomingReceiveAddresses(view: Pick<WalletView, 'wallet' | 'lastUsed' | 'used'>, count: number): DerivedAddress[] {
  const { wallet } = view;
  if (wallet.kind === 'address-list') {
    return wallet.addresses.filter((a) => !view.used.has(a.address)).slice(0, count);
  }
  const from = currentReceiveIndex(wallet, view.lastUsed);
  return wallet.addresses
    .filter((a) => a.chain === 0 && a.index >= from && a.index < from + count)
    .sort((a, b) => a.index - b.index);
}
