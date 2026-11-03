import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { Transaction } from '@interfaces/electrs.interface';
import { firstValueFrom } from 'rxjs';
import { hash as sha256 } from '@app/shared/sha256';
import { RetryOptions, RetryWait, withRetry } from '@app/watch/api-retry';
import { sortNewestFirst } from '@app/watch/wallet-math';
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
  chain?: Chain;
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

/** One collector per scan, so MAX_PAGES bounds the whole scan. Each chunk is paged on its own. */
class HistoryCollector {
  readonly txsById = new Map<string, Transaction>();
  pages = 0;
  truncated = false;
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

      const next = page[page.length - 1].txid;
      // A cursor that stops advancing would spin forever.
      if (next === afterTxid) {
        return [...found.values()];
      }
      afterTxid = next;
      previous = page;
    }
  }

  /** Null when the cursor left both the mempool and the chain, e.g. evicted or replaced. */
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

  async scan(request: WalletScanRequest): Promise<WalletScanResult> {
    const { definition, existingWalletId, isCancelled } = request;
    let last: ScanProgress = { phase: 'deriving', addressesDerived: 0, txsFound: 0, apiRequests: 0 };
    const onProgress = (p: ScanProgress): void => {
      last = p;
      request.onProgress?.(p);
    };
    const retryOptions: RetryOptions = {
      isCancelled,
      onWait: (wait) => request.onProgress?.({ ...last, retry: wait ?? undefined }),
    };
    const addressRequestOptions = this.queued(retryOptions);
    const id = existingWalletId ?? walletId(definition);

    const history = new HistoryCollector(this.electrsApiService, addressRequestOptions);
    const wallet = definition.kind === 'address-list'
      ? await this.scanAddressList(definition, id, history, onProgress)
      : await this.scanDescriptor(definition, id, history, { ...request, onProgress });
    return this.finish(wallet, history, onProgress);
  }

  private finish(wallet: WatchWallet, history: HistoryCollector, onProgress: (p: ScanProgress) => void): WalletScanResult {
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
  ): Promise<DescriptorWallet> {
    const { descriptor, network, gapLimit } = definition;
    const derivedCount: Record<Chain, number> = { 0: 0, 1: 0 };
    const addresses: DerivedAddress[] = [];
    const byAddress = new Map<string, DerivedAddress>();

    const report = (phase: ScanProgress['phase'], chain: Chain, apiRequests: number): void => onProgress?.({
      phase,
      addressesDerived: addresses.length,
      txsFound: history.found(),
      chain,
      apiRequests,
    });

    const extend = async (chain: Chain, count: number): Promise<DerivedAddress[]> => {
      report('deriving', chain, history.requests);
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
      () => report('fetching', targets[0].chain, history.requests + 1),
    );

    const lastUsedOn = (chain: Chain): number => {
      let last = -1;
      const touch = (address?: string): void => {
        const d = address ? byAddress.get(address) : undefined;
        if (d && d.chain === chain && d.index > last) {
          last = d.index;
        }
      };
      for (const tx of history.txsById.values()) {
        for (const vin of tx.vin || []) {
          touch(vin.prevout?.scriptpubkey_address);
        }
        for (const vout of tx.vout || []) {
          touch(vout.scriptpubkey_address);
        }
      }
      return last;
    };

    await fetchFor(await extend(0, gapLimit));
    await fetchFor(await extend(1, gapLimit));

    // A receive address already handed out may be paid later, so never shrink the window, even
    // when a truncated history skips fetching it.
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
