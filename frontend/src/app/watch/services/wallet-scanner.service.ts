import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { Transaction } from '@interfaces/electrs.interface';
import { firstValueFrom } from 'rxjs';
import { hash as sha256 } from '@app/shared/sha256';
import { RequestCancelledError, RetryOptions, RetryWait, withRetry } from '@app/watch/api-retry';
import { computeUsage, sortNewestFirst, txAddresses } from '@app/watch/wallet-math';
import {
  AddressListWallet,
  AddressListWalletDefinition,
  Chain,
  DerivedAddress,
  DescriptorWallet,
  DescriptorWalletDefinition,
  WalletDefinition,
  WatchWallet,
} from '@app/watch/watch.types';
import { DerivationService } from '@app/watch/services/derivation.service';
import { AddressRequestQueue } from '@app/watch/request-queue';

/** Beyond this the scan is reported as truncated rather than shown as complete. */
const MAX_PAGES = 200;
const PAGE_SIZE = 50;

/** Smaller request bodies keep each history request quick to answer. */
const MAX_ADDRESSES_PER_REQUEST = 100;

/** Restarts of one chunk's paging after its cursor moves between mempool and chain (see continuesFrom). */
const MAX_RESTARTS = 3;

const REFETCH_DEPTH = 6;

export function walletId(definition: WalletDefinition): string {
  const { network } = definition;
  const what = definition.kind === 'address-list'
    ? `addresses:${definition.addresses.map((a) => a.address).join(',')}`
    : definition.descriptor;
  const bytes = new TextEncoder().encode(`${network}\n${what}`);
  const digest = sha256(bytes);
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${network}-${hex}`;
}

export interface ScanProgress {
  phase: 'deriving' | 'fetching' | 'done';
  addressesDerived: number;
  txsFound: number;
  apiRequests: number;
  retry?: RetryWait;
}

export interface WalletScanRequest {
  definition: WalletDefinition;
  existingWalletId?: string;
  /** Descriptor wallets only. */
  minimumDerived?: Record<Chain, number>;
  onProgress?: (p: ScanProgress) => void;
  isCancelled?: () => boolean;
}

export interface HistoryCache {
  tipHash: string;
  tipHeight: number;
  confirmed: Transaction[];
}

export interface WalletRefreshRequest extends WalletScanRequest {
  definition: WatchWallet;
  cache: HistoryCache;
}

export interface WalletScanResult {
  wallet: WatchWallet;
  txs: Transaction[];
  truncated: boolean;
}

/** The caller keeps what it showed before. */
export class ScanIncompleteError extends Error {
  constructor() {
    super('Scan incomplete: history moved');
  }
}

/** Whether `page` carries on from `previous`; it may not if the cursor confirmed (or was reorged back) meanwhile. */
function continuesFrom(previous: Transaction[], page: Transaction[]): boolean {
  const cursorConfirmed = !!previous[previous.length - 1].status?.confirmed;
  if (page.length === 0) {
    // A short unconfirmed page had room for confirmed history, so an empty one next is the end.
    return cursorConfirmed || previous.length < PAGE_SIZE;
  }
  return !!page[0].status?.confirmed === cursorConfirmed;
}

function outpointsOf(tx: Transaction): string[] {
  return (tx.vin || []).filter((vin) => !vin.is_coinbase).map((vin) => `${vin.txid}:${vin.vout}`);
}

function confirmedSpenders(txs: Transaction[]): Map<string, string> | null {
  const spenders = new Map<string, string>();
  for (const tx of txs.filter((t) => t.status?.confirmed)) {
    for (const outpoint of outpointsOf(tx)) {
      if ((spenders.get(outpoint) ?? tx.txid) !== tx.txid) {
        return null;
      }
      spenders.set(outpoint, tx.txid);
    }
  }
  return spenders;
}

function newerReplacement(a: Transaction, b: Transaction): Transaction {
  if (a.fee !== b.fee) {
    return a.fee > b.fee ? a : b;
  }
  return a.txid < b.txid ? a : b;
}

function replacedTxids(unconfirmed: Transaction[]): Set<string> {
  const winners = new Map<string, Transaction>();
  for (const tx of unconfirmed) {
    for (const outpoint of outpointsOf(tx)) {
      const other = winners.get(outpoint);
      winners.set(outpoint, other ? newerReplacement(other, tx) : tx);
    }
  }
  return new Set(unconfirmed.filter((tx) => outpointsOf(tx).some((o) => winners.get(o) !== tx)).map((tx) => tx.txid));
}

function unconfirmedOf(txsById: Map<string, Transaction>): Transaction[] {
  return [...txsById.values()].filter((tx) => !tx.status?.confirmed);
}

function dropWithDescendants(txsById: Map<string, Transaction>, dropped: Set<string>): void {
  let grew = dropped.size > 0;
  while (grew) {
    grew = false;
    for (const tx of unconfirmedOf(txsById).filter((t) => !dropped.has(t.txid) && t.vin?.some((v) => dropped.has(v.txid)))) {
      dropped.add(tx.txid);
      grew = true;
    }
  }
  for (const txid of dropped) {
    txsById.delete(txid);
  }
}

/** False if two confirmed transactions spend one outpoint, which only a rescan can settle. */
function resolveConflicts(txsById: Map<string, Transaction>): boolean {
  const confirmed = confirmedSpenders([...txsById.values()]);
  if (!confirmed) {
    return false;
  }
  const doubleSpends = unconfirmedOf(txsById).filter((tx) => outpointsOf(tx).some((outpoint) => confirmed.has(outpoint)));
  dropWithDescendants(txsById, new Set(doubleSpends.map((tx) => tx.txid)));
  dropWithDescendants(txsById, replacedTxids(unconfirmedOf(txsById)));
  return true;
}

/**
 * Applies transactions seen on the websocket to a history. Removed ones (replaced, evicted or
 * expired) go with their unconfirmed descendants, and conflicts are settled as a scan settles
 * them. Null if the result needs a rescan.
 */
export function applyLiveUpdate(txs: Transaction[], added: Transaction[], removed: Transaction[]): Transaction[] | null {
  const txsById = new Map(txs.map((tx) => [tx.txid, tx]));
  const arriving = new Set(added.map((tx) => tx.txid));
  // New arrivals go first among the unconfirmed, newest first where firstSeen is known.
  const fresh = added.filter((tx) => !txsById.has(tx.txid)).sort((a, b) => (b.firstSeen ?? 0) - (a.firstSeen ?? 0));
  dropWithDescendants(txsById, new Set(removed
    .filter((tx) => !arriving.has(tx.txid) && txsById.has(tx.txid) && !txsById.get(tx.txid).status?.confirmed)
    .map((tx) => tx.txid)));
  for (const tx of added) {
    // A mempool copy of a transaction already confirmed is stale.
    if (!txsById.get(tx.txid)?.status?.confirmed || tx.status?.confirmed) {
      txsById.set(tx.txid, tx);
    }
  }
  if (!resolveConflicts(txsById)) {
    return null;
  }
  const freshIds = new Set(fresh.map((tx) => tx.txid));
  const kept = fresh.filter((tx) => txsById.has(tx.txid)).map((tx) => txsById.get(tx.txid));
  return sortNewestFirst([...kept, ...[...txsById.values()].filter((tx) => !freshIds.has(tx.txid))]);
}

function withoutUiState(tx: Transaction): Transaction {
  const copy = { ...tx };
  for (const key of Object.keys(copy).filter((k) => k.startsWith('_'))) {
    delete copy[key];
  }
  return copy;
}

/** One collector per scan, so MAX_PAGES bounds the whole scan. Each chunk is paged on its own. */
class HistoryCollector {
  readonly txsById = new Map<string, Transaction>();
  pages = 0;
  truncated = false;
  stopAtHeight: number | null = null;
  /** The chunk being read; stored only once read in full. */
  private reading = new Map<string, Transaction>();

  constructor(
    private electrsApiService: ElectrsApiService,
    private retryOptions: RetryOptions,
  ) {}

  get requests(): number {
    return this.pages;
  }

  found(): number {
    let pending = 0;
    for (const txid of this.reading.keys()) {
      if (!this.txsById.has(txid)) {
        pending++;
      }
    }
    return this.txsById.size + pending;
  }

  async fetch(addresses: string[], beforeRequest: () => void): Promise<void> {
    for (let start = 0; start < addresses.length && !this.truncated; start += MAX_ADDRESSES_PER_REQUEST) {
      const chunk = await this.fetchChunk(addresses.slice(start, start + MAX_ADDRESSES_PER_REQUEST), beforeRequest);
      for (const tx of chunk) {
        this.txsById.set(tx.txid, tx);
      }
    }
  }

  /** Pages to an empty answer; a chunk whose cursor moved is checked once, then read again from the top. */
  private async fetchChunk(addresses: string[], beforeRequest: () => void): Promise<Transaction[]> {
    const found = new Map<string, Transaction>();
    this.reading = found;
    let afterTxid: string | undefined;
    let previous: Transaction[] = [];
    let checking: { cursor: string; answer: string } | null = null;
    /** The same answer at the same cursor after a restart is taken as it is. */
    const restartedOn = new Set<string>();
    let restarts = 0;
    const restart = (answer: string): void => {
      if (restarts >= MAX_RESTARTS) {
        throw new ScanIncompleteError();
      }
      restarts++;
      restartedOn.add(answer);
      found.clear();
      afterTxid = undefined;
      previous = [];
    };

    for (;;) {
      if (this.pages >= MAX_PAGES) {
        this.truncated = true;
        return [...found.values()];
      }
      beforeRequest();

      const cursor = afterTxid;
      const page = await this.fetchPage(addresses, cursor);
      this.pages++;

      if (!page) {
        checking = null;
        restart(`${cursor} gone`);
        continue;
      }
      if (checking) {
        const { cursor: moved, answer } = checking;
        checking = null;
        if (page[0]?.txid !== moved || page[0].status?.confirmed) {
          restart(answer);
          continue;
        }
      } else if (cursor && !continuesFrom(previous, page)) {
        const answer = `${cursor} ${page[0]?.txid ?? ''}`;
        if (!restartedOn.has(answer)) {
          if (!previous[previous.length - 1].status?.confirmed && previous.length > 1) {
            checking = { cursor, answer };
            afterTxid = previous[previous.length - 2].txid;
          } else {
            restart(answer);
          }
          continue;
        }
      }

      if (page.length === 0) {
        return [...found.values()];
      }
      for (const tx of page) {
        found.set(tx.txid, tx);
      }

      const oldest = page[page.length - 1];
      if (this.stopAtHeight !== null && oldest.status?.confirmed && oldest.status.block_height <= this.stopAtHeight) {
        return [...found.values()];
      }

      const next = oldest.txid;
      // A cursor that stops advancing would spin forever.
      if (next === afterTxid) {
        return [...found.values()];
      }
      afterTxid = next;
      previous = page;
    }
  }

  private async fetchPage(addresses: string[], cursor: string | undefined): Promise<Transaction[] | null> {
    try {
      return await withRetry(
        () => firstValueFrom(this.electrsApiService.getAddressesTransactions$(addresses, cursor, PAGE_SIZE)),
        this.retryOptions,
      ) || [];
    } catch (e) {
      if (cursor && e instanceof HttpErrorResponse && e.status === 422 && e.error === 'after_txid not found') {
        return null;
      }
      throw e;
    }
  }
}

/**
 * Used addresses are read from the transactions themselves, so one paginated sweep gives both
 * the history and the used set.
 */
@Injectable()
export class WalletScannerService {
  constructor(
    private electrsApiService: ElectrsApiService,
    private derivationService: DerivationService,
    private addressRequestQueue: AddressRequestQueue,
  ) {}

  private queued(options: RetryOptions): RetryOptions {
    return { ...options, queue: this.addressRequestQueue.queue };
  }

  /** One request; a full page can hide an address's history, so the others are then asked for one tx each. */
  async addressesWithHistory(addresses: string[], options: RetryOptions = {}): Promise<Set<string>> {
    const wanted = new Set(addresses);
    const used = new Set<string>();
    const read = async (batch: string[], maxTxs: number): Promise<number> => {
      const page = await withRetry(() => firstValueFrom(this.electrsApiService.getAddressesTransactions$(batch, undefined, maxTxs)), this.queued(options)) || [];
      for (const tx of page) {
        for (const address of txAddresses(tx)) {
          if (wanted.has(address)) {
            used.add(address);
          }
        }
      }
      return page.length;
    };
    if (await read(addresses, PAGE_SIZE) >= PAGE_SIZE) {
      for (const address of addresses.filter((a) => !used.has(a))) {
        await read([address], 1);
      }
    }
    return used;
  }

  async scan(request: WalletScanRequest): Promise<WalletScanResult> {
    return await this.scanOnce(request) ?? this.rescan(request);
  }

  private async rescan(request: WalletScanRequest): Promise<WalletScanResult> {
    const result = await this.scanOnce(request);
    if (!result) {
      throw new ScanIncompleteError();
    }
    return result;
  }

  private async scanOnce(request: WalletScanRequest): Promise<WalletScanResult | null> {
    const { definition, existingWalletId } = request;
    const { history, onProgress } = this.startScan(request);
    const id = existingWalletId ?? walletId(definition);

    const wallet = definition.kind === 'address-list'
      ? await this.scanAddressList(definition, id, history, onProgress)
      : await this.scanDescriptor(definition, id, history, { ...request, onProgress });
    return this.finish(wallet, history, onProgress);
  }

  async refresh(request: WalletRefreshRequest): Promise<WalletScanResult> {
    const { definition: wallet, cache } = request;
    if (!await this.tipStillBest(cache, request.isCancelled)) {
      return this.scan(request);
    }
    const { history, onProgress } = this.startScan(request);
    const sinceHeight = cache.tipHeight - REFETCH_DEPTH;
    history.stopAtHeight = sinceHeight;
    await history.fetch(wallet.addresses.map((a) => a.address), () => onProgress({
      phase: 'fetching',
      addressesDerived: wallet.addresses.length,
      txsFound: history.found(),
      apiRequests: history.requests + 1,
    }));
    if (history.truncated) {
      return this.scan(request);
    }
    for (const tx of cache.confirmed) {
      if (tx.status.block_height <= sinceHeight && !history.txsById.has(tx.txid)) {
        history.txsById.set(tx.txid, withoutUiState(tx));
      }
    }
    history.stopAtHeight = null;

    const scanned = wallet.kind === 'address-list'
      ? wallet
      : await this.scanDescriptor(wallet, wallet.id, history, { ...request, onProgress }, wallet);
    return this.finish(scanned, history, onProgress) ?? this.rescan(request);
  }

  private startScan(request: WalletScanRequest): { history: HistoryCollector; onProgress: (p: ScanProgress) => void } {
    let last: ScanProgress = { phase: 'deriving', addressesDerived: 0, txsFound: 0, apiRequests: 0 };
    const onProgress = (p: ScanProgress): void => {
      last = p;
      request.onProgress?.(p);
    };
    const retryOptions: RetryOptions = {
      isCancelled: request.isCancelled,
      onWait: (wait) => request.onProgress?.({ ...last, retry: wait ?? undefined }),
    };
    return { history: new HistoryCollector(this.electrsApiService, this.queued(retryOptions)), onProgress };
  }

  private async tipStillBest(cache: HistoryCache, isCancelled?: () => boolean): Promise<boolean> {
    try {
      const hash = await withRetry(() => firstValueFrom(this.electrsApiService.getBlockHashFromHeight$(cache.tipHeight)), { isCancelled });
      return hash?.trim() === cache.tipHash;
    } catch (e) {
      if (e instanceof RequestCancelledError) {
        throw e;
      }
      return false;
    }
  }

  private finish(wallet: WatchWallet, history: HistoryCollector, onProgress: (p: ScanProgress) => void): WalletScanResult | null {
    if (!resolveConflicts(history.txsById)) {
      return null;
    }
    const txs = sortNewestFirst([...history.txsById.values()]);
    onProgress({ phase: 'done', addressesDerived: wallet.addresses.length, txsFound: txs.length, apiRequests: history.requests });
    return { wallet, txs, truncated: history.truncated };
  }

  private async scanAddressList(
    definition: AddressListWalletDefinition,
    id: string,
    history: HistoryCollector,
    onProgress?: (p: ScanProgress) => void,
  ): Promise<AddressListWallet> {
    const addresses = definition.addresses;
    await history.fetch(addresses.map((a) => a.address), () => onProgress?.({
      phase: 'fetching',
      addressesDerived: addresses.length,
      txsFound: history.found(),
      apiRequests: history.requests + 1,
    }));
    return { ...definition, id, derivedCount: { 0: addresses.length, 1: 0 } };
  }

  private async scanDescriptor(
    definition: DescriptorWalletDefinition,
    id: string,
    history: HistoryCollector,
    { onProgress, minimumDerived, isCancelled }: WalletScanRequest,
    scanned?: DescriptorWallet,
  ): Promise<DescriptorWallet> {
    const { descriptor, network, gapLimit } = definition;
    const derivedCount: Record<Chain, number> = scanned ? { ...scanned.derivedCount } : { 0: 0, 1: 0 };
    const addresses: DerivedAddress[] = scanned ? [...scanned.addresses] : [];
    const byAddress = new Map(addresses.map((a) => [a.address, a]));

    const report = (phase: ScanProgress['phase'], apiRequests: number): void => onProgress?.({
      phase,
      addressesDerived: addresses.length,
      txsFound: history.found(),
      apiRequests,
    });

    const extend = async (chain: Chain, count: number): Promise<DerivedAddress[]> => {
      report('deriving', history.requests);
      const from = derivedCount[chain];
      const fresh = await this.derivationService.derive(descriptor, network, chain, from, count, isCancelled);
      derivedCount[chain] = from + count;
      for (const a of fresh) {
        addresses.push(a);
        byAddress.set(a.address, a);
      }
      return fresh;
    };

    const fetchFor = (targets: DerivedAddress[]): Promise<void> => history.fetch(
      targets.map((a) => a.address),
      () => report('fetching', history.requests + 1),
    );

    const lastUsedOn = (chain: Chain): number => computeUsage([...history.txsById.values()], byAddress).lastUsed[chain];

    if (!scanned) {
      const receive = await extend(0, gapLimit);
      await fetchFor([...receive, ...await extend(1, gapLimit)]);
    }

    // A receive address already handed out may be paid later, so never shrink the window.
    for (const chain of [0, 1] as Chain[]) {
      const missing = (minimumDerived?.[chain] ?? 0) - derivedCount[chain];
      if (missing > 0) {
        await fetchFor(await extend(chain, missing));
      }
    }

    for (;;) {
      let extended = false;
      for (const chain of [0, 1] as Chain[]) {
        while (lastUsedOn(chain) >= derivedCount[chain] - gapLimit) {
          await fetchFor(await extend(chain, lastUsedOn(chain) + gapLimit + 1 - derivedCount[chain]));
          extended = true;
          if (history.truncated) {
            break;
          }
        }
      }
      if (!extended || history.truncated) {
        break;
      }
    }

    return { ...definition, id, derivedCount, addresses };
  }
}
