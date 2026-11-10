import { Injectable } from '@angular/core';
import { StorageService } from '@app/services/storage.service';
import { WatchNetwork, WatchWallet } from '@app/watch/watch.types';

const STORAGE_KEY = 'watch-wallets';
const ACTIVE_KEY = 'watch-active-wallet';

const NETWORKS: readonly unknown[] = ['mainnet', 'testnet', 'signet'] satisfies WatchNetwork[];

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const isOptional = (value: unknown, check: (v: unknown) => boolean): boolean => value === undefined || check(value);
const isString = (value: unknown): value is string => typeof value === 'string';

function isAddress(address: unknown): boolean {
  return isObject(address)
    && isString(address.address) && address.address !== ''
    && (address.chain === 0 || address.chain === 1)
    && isCount(address.index)
    && isOptional(address.scriptPubKey, isString);
}

function isKeyInfo(key: unknown): boolean {
  return isObject(key)
    && isString(key.fingerprint)
    && typeof key.fingerprintIsMaster === 'boolean'
    && isOptional(key.originPath, isString)
    && isOptional(key.fixedStep, (v) => Number.isInteger(v));
}

function isMultisig(multisig: unknown): boolean {
  return isObject(multisig)
    && Array.isArray(multisig.keys) && multisig.keys.length > 0 && multisig.keys.every(isKeyInfo)
    && Number.isInteger(multisig.threshold) && (multisig.threshold as number) >= 1
    && (multisig.threshold as number) <= multisig.keys.length;
}

function hasWalletFields(record: Record<string, unknown>): boolean {
  return isString(record.id) && record.id !== ''
    && isString(record.label)
    && NETWORKS.includes(record.network)
    && isObject(record.derivedCount) && isCount(record.derivedCount[0]) && isCount(record.derivedCount[1])
    && Array.isArray(record.addresses) && record.addresses.every(isAddress);
}

// A record missing a field the scanner relies on would fail every scan, and with no view the
// user could not reach Settings to forget it, so it is treated as unreadable.
function readRecord(record: unknown): WatchWallet | null {
  if (!isObject(record) || !hasWalletFields(record)) {
    return null;
  }
  if (record.kind === 'address-list') {
    return record as unknown as WatchWallet;
  }
  if (
    record.kind === 'descriptor'
    && isString(record.descriptor) && record.descriptor !== ''
    && isString(record.source)
    && isString(record.scriptType)
    && Number.isInteger(record.gapLimit) && (record.gapLimit as number) > 0
    && isOptional(record.receiveIndex, isCount)
    && isOptional(record.fingerprint, isString)
    && isOptional(record.originPath, isString)
    && isOptional(record.fingerprintIsMaster, (v) => typeof v === 'boolean')
    && isOptional(record.multisig, isMultisig)
  ) {
    return record as unknown as WatchWallet;
  }
  return null;
}

/**
 * Saved wallets, in local storage only. A descriptor wallet's `source` (the pasted key) is
 * stored in plaintext so the gap limit can grow without asking for the key again; script on
 * this origin could read it. All access goes through this class so that can change in one place.
 *
 * Unreadable records stay in the list untouched, and a list that can't be parsed is never
 * overwritten.
 */
@Injectable()
export class WalletStorageService {
  constructor(private storageService: StorageService) {}

  load(network: WatchNetwork): WatchWallet[] {
    return (this.readRecords() ?? [])
      .map(readRecord)
      .filter((w): w is WatchWallet => w !== null && w.network === network);
  }

  save(wallet: WatchWallet): void {
    const records = this.readRecords();
    if (!records) {
      return;
    }
    const index = records.findIndex((r) => readRecord(r)?.id === wallet.id);
    if (index >= 0) {
      records[index] = wallet;
    } else {
      records.push(wallet);
    }
    this.persist(records);
  }

  /** Put `wallet` where the wallet `oldId` was, e.g. after re-importing it under another script type. */
  replace(oldId: string, wallet: WatchWallet): void {
    const records = this.readRecords()?.filter((r) => readRecord(r)?.id !== wallet.id);
    if (!records) {
      return;
    }
    const index = records.findIndex((r) => readRecord(r)?.id === oldId);
    if (index >= 0) {
      records[index] = wallet;
    } else {
      records.push(wallet);
    }
    this.persist(records);
  }

  remove(id: string): void {
    const records = this.readRecords();
    if (records) {
      this.persist(records.filter((r) => readRecord(r)?.id !== id));
    }
  }

  /** The wallet last shown on each network. */
  loadActiveId(network: WatchNetwork): string | null {
    const active = this.readActive()[network];
    return isString(active) ? active : null;
  }

  saveActiveId(network: WatchNetwork, id: string): void {
    const active = this.readActive();
    if (active[network] !== id) {
      this.storageService.setValue(ACTIVE_KEY, JSON.stringify({ ...active, [network]: id }));
    }
  }

  private readActive(): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(this.storageService.getValue(ACTIVE_KEY) || '{}');
      return isObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  /** Null when the stored list can't be parsed. */
  private readRecords(): unknown[] | null {
    const raw = this.storageService.getValue(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private persist(records: unknown[]): void {
    this.storageService.setValue(STORAGE_KEY, JSON.stringify(records));
  }
}
