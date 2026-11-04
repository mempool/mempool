import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, fromEvent, Subscription } from 'rxjs';
import { Transaction } from '@interfaces/electrs.interface';
import { looksLikeAddressList } from '@app/watch/address-list';
import { addressMapOf, buildWalletView, currentReceiveIndex, WalletView } from '@app/watch/wallet-math';
import { fromMempoolNetwork } from '@app/watch/watch-key.utils';
import { ScriptType, WalletDefinition, WatchNetwork, WatchWallet } from '@app/watch/watch.types';
import { DerivationService } from '@app/watch/services/derivation.service';
import { applyLiveUpdate, HistoryCache, ScanIncompleteError, ScanProgress, walletId, WalletScannerService } from '@app/watch/services/wallet-scanner.service';
import { BlockExtended } from '@interfaces/node-api.interface';
import { WalletStorageService } from '@app/watch/services/wallet-storage.service';
import { LiveUpdate, trackedAddresses, WalletTrackerService } from '@app/watch/services/wallet-tracker.service';

export const MIN_GAP_LIMIT = 5;
export const MAX_GAP_LIMIT = 1000;
export const DEFAULT_GAP_LIMIT = 20;

/** A burst of websocket updates is checked against the server once. */
const LIVE_REFRESH_DELAY_MS = 3000;
/** A live-triggered refresh starts at least this long after the last refresh of any kind finished. */
const LIVE_REFRESH_INTERVAL_MS = 30_000;

export interface WalletImportForm {
  input: string;
  label: string;
  gapLimit: number;
  /** For a bare xpub/tpub, which does not say which script type it is. */
  scriptTypeHint?: ScriptType;
}

export interface WalletPageState {
  /** Null on a network the wallet does not support. */
  network: WatchNetwork | null;
  wallets: WatchWallet[];
  activeId: string | null;
  view: WalletView | null;
  /** Unix seconds. */
  updatedAt: number | null;
  adding: boolean;
  scanning: boolean;
  progress: ScanProgress | null;
  error: string | null;
  notice: string | null;
  /** 'on' while the shown wallet's addresses are tracked; otherwise it refreshes per block only. */
  liveUpdates: 'on' | 'off' | 'refused';
}

const INITIAL_STATE: WalletPageState = {
  network: null,
  wallets: [],
  activeId: null,
  view: null,
  updatedAt: null,
  adding: false,
  scanning: false,
  progress: null,
  error: null,
  notice: null,
  liveUpdates: 'off',
};

function errorMessage(e: unknown): string {
  if (e instanceof ScanIncompleteError) {
    return $localize`:@@watch.scan-history-moved:The wallet's history kept changing on the server while it was being read, so it could not be read completely. Nothing was changed; try again in a moment.`;
  }
  if (e instanceof HttpErrorResponse) {
    switch (e.status) {
      case 429:
        return $localize`:@@watch.api-error-rate-limited:The server is limiting requests from this browser and the retries ran out. Nothing was changed; try again in a few minutes.`;
      case 503:
        return $localize`:@@watch.api-error-busy:The server is busy and the retries ran out. Nothing was changed; try again in a few minutes.`;
      case 413:
      case 504:
        return $localize`:@@watch.api-error-too-heavy:The server could not answer this wallet's history query in time (${e.status}:status:). Nothing was changed. A smaller gap limit or address list may help.`;
    }
    return $localize`:@@watch.api-error:Could not load the wallet's history from the server (${e.status || 'no response'}:status:). Nothing was changed; try again later.`;
  }
  return e instanceof Error ? e.message : String(e);
}

function validGapLimit(value: number): number {
  const gapLimit = Number(value);
  if (!Number.isInteger(gapLimit) || gapLimit < MIN_GAP_LIMIT || gapLimit > MAX_GAP_LIMIT) {
    throw new Error($localize`:@@watch.gap-limit-invalid:Gap limit must be a whole number from ${MIN_GAP_LIMIT}:min: to ${MAX_GAP_LIMIT}:max:.`);
  }
  return gapLimit;
}

/**
 * State and actions for the /wallet page, provided by WatchComponent. One scan runs at a
 * time; `generation` discards the result of a scan overtaken by a network change. A wallet is
 * scanned in full when it is shown; on Check Mempool, a new block or a reconnect, only what changed
 * since its cached history is read, and a hidden tab waits until it is shown again. Between
 * blocks a wallet of up to ten addresses is updated from the websocket. Each burst of updates
 * also queues the incremental refresh, no sooner than LIVE_REFRESH_INTERVAL_MS after the last
 * scan ended, as the websocket does not report every removal; updates that arrive during a
 * refresh are applied again to its result. A wallet whose history is truncated gets neither
 * automatic refresh, as each would be a full rescan.
 */
@Injectable()
export class WalletSessionService implements OnDestroy {
  readonly state$ = new BehaviorSubject<WalletPageState>(INITIAL_STATE);

  private views = new Map<string, WalletView>();
  private scannedAt = new Map<string, number>();
  private caches = new Map<string, HistoryCache>();
  private generation = 0;
  private mempoolNetwork: string | null = null;
  private refreshQueued = false;
  /** The queued refresh only answers new blocks or live updates, so a truncated wallet can skip it. */
  private queuedForChain = false;
  /** Queued only by the live refresh timer, which a newly imported wallet does not need. */
  private refreshQueuedByLive = false;
  private updatesDuringScan: LiveUpdate[] = [];
  private liveRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  /** Date.now() when the last scan finished. */
  private lastScanEnd = 0;
  /** A live update arrived during a scan; its refresh is scheduled once the scan ends. */
  private liveRefreshWanted = false;
  /** Wallet ids the server refused to track. */
  private refused = new Set<string>();
  private visibilitySubscription: Subscription;

  constructor(
    private derivation: DerivationService,
    private scanner: WalletScannerService,
    private storage: WalletStorageService,
    private tracker: WalletTrackerService,
  ) {
    this.tracker.watchChain(() => this.onChainChange());
    this.visibilitySubscription = fromEvent(document, 'visibilitychange').subscribe(() => this.runQueuedRefresh());
  }

  get state(): WalletPageState {
    return this.state$.value;
  }

  get activeWallet(): WatchWallet | null {
    return this.state.wallets.find((w) => w.id === this.state.activeId) ?? null;
  }

  /** '' is mainnet. */
  setNetwork(mempoolNetwork: string): void {
    this.generation++;
    this.tracker.stop();
    this.cancelLiveRefresh();
    this.refused.clear();
    if (this.mempoolNetwork !== null && this.mempoolNetwork !== mempoolNetwork) {
      this.tracker.resetChain();
    }
    this.mempoolNetwork = mempoolNetwork;
    this.refreshQueued = false;
    this.queuedForChain = false;
    this.refreshQueuedByLive = false;
    this.views.clear();
    this.scannedAt.clear();
    this.caches.clear();
    const network = fromMempoolNetwork(mempoolNetwork);
    const wallets = network ? this.storage.load(network) : [];
    this.state$.next({ ...INITIAL_STATE, network, wallets });
    if (wallets.length) {
      const savedId = network ? this.storage.loadActiveId(network) : null;
      this.activate(wallets.find((w) => w.id === savedId)?.id ?? wallets[0].id);
    }
  }

  startAdding(): void {
    if (this.state.scanning) {
      return;
    }
    // The shown wallet stays tracked while the form is open.
    this.patch({ adding: true, error: null, notice: null });
  }

  cancelAdding(): void {
    this.patch({ adding: false, error: null });
    this.runQueuedRefresh();
  }

  activate(id: string): Promise<void> {
    return this.show(id, null);
  }

  async importWallet(form: WalletImportForm): Promise<void> {
    const network = this.state.network;
    if (this.state.scanning || !network) {
      return;
    }
    let duplicate: WatchWallet | undefined;
    await this.runScan(async (generation) => {
      const definition = await this.toDefinition(form, network);
      const id = walletId(definition);
      if (generation !== this.generation) {
        return;
      }
      // Rescanning a saved wallet afresh would drop its receive cursor and grown gap limit.
      duplicate = this.state.wallets.find((w) => w.id === id);
      if (duplicate) {
        return;
      }
      const tip = this.tracker.tip;
      const { wallet, txs, truncated } = await this.scanner.scan({
        definition,
        existingWalletId: id,
        onProgress: this.progressReporter(generation),
        isCancelled: () => generation !== this.generation,
      });
      if (generation !== this.generation) {
        return;
      }
      // Updates that reached the wallet behind the form during the import, for addresses the
      // imported wallet shares with it.
      const updates = this.updatesFor(wallet);
      const replayed = this.replay(txs, updates);
      this.cancelLiveRefresh();
      if (this.refreshQueuedByLive) {
        this.refreshQueued = false;
        this.queuedForChain = false;
        this.refreshQueuedByLive = false;
      }
      // Their follow-up refresh is still due, as after any refresh; it also reconciles updates
      // that could not be replayed.
      this.liveRefreshWanted = updates.length > 0;
      this.storeView(buildWalletView(wallet, replayed ?? txs, truncated));
      this.storeCache(wallet.id, truncated ? undefined : tip, txs);
      this.patch({ activeId: wallet.id, adding: false, notice: null });
      this.storage.saveActiveId(network, wallet.id);
    });
    if (duplicate) {
      await this.show(duplicate.id, $localize`:@@watch.already-saved:This wallet is already saved as “${duplicate.label}:label:”. Showing it with its saved settings.`);
    }
  }

  clearError(): void {
    if (this.state.error) {
      this.patch({ error: null });
    }
  }

  refresh(): Promise<void> {
    return this.refreshActive();
  }

  /**
   * Reads only what changed since the cached history, as on a new block. Without a usable cache
   * (first scan failed, truncated, or the cached tip left the best chain) this is a full scan.
   */
  checkMempool(): Promise<void> {
    return this.refreshActive(true);
  }

  rename(label: string): void {
    const wallet = this.activeWallet;
    const name = label.trim();
    if (wallet && name && name !== wallet.label) {
      this.updateWallet({ ...wallet, label: name });
    }
  }

  async setGapLimit(value: number): Promise<void> {
    const wallet = this.activeWallet;
    if (wallet?.kind !== 'descriptor' || this.state.scanning) {
      return;
    }
    let gapLimit: number;
    try {
      gapLimit = validGapLimit(value);
    } catch (e) {
      this.patch({ error: errorMessage(e) });
      return;
    }
    if (gapLimit === wallet.gapLimit) {
      return;
    }
    // A lower limit drops nothing: addresses are never forgotten.
    this.updateWallet({ ...wallet, gapLimit });
    if (gapLimit < wallet.gapLimit) {
      return;
    }
    await this.refreshActive();
  }

  useNextReceiveAddress(): void {
    const wallet = this.state.view?.wallet;
    if (wallet?.kind !== 'descriptor') {
      return;
    }
    const next = currentReceiveIndex(wallet, this.state.view.lastUsed) + 1;
    if (wallet.addresses.some((a) => a.chain === 0 && a.index === next)) {
      this.updateWallet({ ...wallet, receiveIndex: next });
    }
  }

  forget(): void {
    const wallet = this.activeWallet;
    if (!wallet || this.state.scanning) {
      return;
    }
    this.tracker.stop();
    this.storage.remove(wallet.id);
    this.dropSessionState(wallet.id);
    const wallets = this.state.wallets.filter((w) => w.id !== wallet.id);
    this.patch({ wallets, activeId: null, view: null, updatedAt: null, error: null, notice: null });
    if (wallets.length) {
      this.activate(wallets[0].id);
    }
  }

  ngOnDestroy(): void {
    this.generation++;
    this.cancelLiveRefresh();
    this.visibilitySubscription.unsubscribe();
  }

  private async toDefinition(form: WalletImportForm, network: WatchNetwork): Promise<WalletDefinition> {
    const input = form.input.trim();
    const label = form.label.trim() || $localize`:@@watch.default-wallet-name:My wallet`;
    if (looksLikeAddressList(input)) {
      const addresses = await this.derivation.parseAddressList(input, network);
      return { kind: 'address-list', label, network, addresses };
    }
    const gapLimit = validGapLimit(form.gapLimit);
    const prepared = await this.derivation.prepare(input, network, form.scriptTypeHint);
    return {
      kind: 'descriptor',
      label,
      source: input,
      descriptor: prepared.descriptor,
      scriptType: prepared.scriptType,
      fingerprint: prepared.fingerprint,
      fingerprintIsMaster: prepared.fingerprintIsMaster,
      originPath: prepared.originPath,
      multisig: prepared.multisig,
      network,
      gapLimit,
    };
  }

  private patch(changes: Partial<WalletPageState>): void {
    this.state$.next({ ...this.state, ...changes });
  }

  private progressReporter(generation: number): (p: ScanProgress) => void {
    return (progress) => {
      if (generation === this.generation) {
        this.patch({ progress });
      }
    };
  }

  private async runScan(scan: (generation: number) => Promise<void>): Promise<void> {
    const generation = ++this.generation;
    this.patch({ scanning: true, progress: null, error: null });
    try {
      await scan(generation);
    } catch (e) {
      if (generation === this.generation) {
        this.patch({ error: errorMessage(e) });
      }
    } finally {
      if (generation === this.generation) {
        this.updatesDuringScan = [];
        this.lastScanEnd = Date.now();
        this.patch({ scanning: false, progress: null });
        this.startTracking();
        if (this.liveRefreshWanted) {
          this.liveRefreshWanted = false;
          this.scheduleLiveRefresh();
        }
        this.runQueuedRefresh();
      }
    }
  }

  private async show(id: string, notice: string | null): Promise<void> {
    if (this.state.scanning || !this.state.wallets.some((w) => w.id === id)) {
      return;
    }
    this.tracker.stop();
    this.cancelLiveRefresh();
    const view = this.views.get(id) ?? null;
    this.patch({ activeId: id, view, updatedAt: this.scannedAt.get(id) ?? null, adding: false, error: null, notice, liveUpdates: 'off' });
    this.startTracking();
    if (this.state.network) {
      this.storage.saveActiveId(this.state.network, id);
    }
    await this.refresh();
  }

  private onChainChange(live = false): void {
    // Queued during a scan, the block is weighed against the scan's result (runQueuedRefresh):
    // the view shown now may be about to be replaced by a complete one.
    if (this.state.scanning || this.state.adding || document.hidden) {
      this.queueRefresh(live ? 'live' : 'chain');
      return;
    }
    // A truncated history is already incomplete, and rescanning it takes longer than a block
    // interval: refreshing on every block would keep the wallet scanning without pause.
    if (this.state.view?.truncated) {
      return;
    }
    void this.refreshActive(true);
  }

  /**
   * 'chain' (a block, or live updates that need reconciling) and 'live' (the live refresh timer)
   * are dropped for a truncated wallet; 'live' alone is also dropped by an import.
   */
  private queueRefresh(source: 'chain' | 'live' | 'settings'): void {
    const fresh = !this.refreshQueued;
    this.queuedForChain = source !== 'settings' && (this.queuedForChain || fresh);
    this.refreshQueuedByLive = source === 'live' && (this.refreshQueuedByLive || fresh);
    this.refreshQueued = true;
  }

  private runQueuedRefresh(): void {
    // Only once the scan is over: until then the view shown may be about to be replaced.
    if (this.refreshQueued && this.queuedForChain && !this.state.scanning && this.state.view?.truncated) {
      this.refreshQueued = false;
      this.queuedForChain = false;
      this.refreshQueuedByLive = false;
      return;
    }
    if (this.refreshQueued && !this.state.adding && !this.state.scanning && !document.hidden && this.activeWallet) {
      void this.refreshActive(true);
    }
  }

  private async refreshActive(incremental = false): Promise<void> {
    const wallet = this.activeWallet;
    if (!wallet || this.state.scanning) {
      return;
    }
    this.refreshQueued = false;
    this.queuedForChain = false;
    this.refreshQueuedByLive = false;
    const tip = this.tracker.tip;
    const cache = incremental ? this.caches.get(wallet.id) : undefined;
    this.caches.delete(wallet.id);
    // This refresh starts after any update still waiting for one.
    this.cancelLiveRefresh();
    this.updatesDuringScan = [];
    await this.runScan(async (generation) => {
      const request = {
        definition: wallet,
        existingWalletId: wallet.id,
        minimumDerived: wallet.kind === 'descriptor' ? {
          0: Math.max(wallet.derivedCount[0], (wallet.receiveIndex ?? 0) + 1),
          1: wallet.derivedCount[1],
        } : undefined,
        onProgress: this.progressReporter(generation),
        isCancelled: () => generation !== this.generation,
      };
      const { wallet: scanned, txs, truncated } = cache
        ? await this.scanner.refresh({ ...request, cache })
        : await this.scanner.scan(request);
      if (generation !== this.generation || this.state.activeId !== scanned.id) {
        return;
      }
      // Keep settings changed during the scan; a changed gap limit needs another scan.
      const current = this.activeWallet ?? wallet;
      let merged: WatchWallet = { ...scanned, label: current.label };
      let gapLimitChanged = false;
      if (scanned.kind === 'descriptor' && current.kind === 'descriptor') {
        merged = { ...scanned, label: current.label, receiveIndex: current.receiveIndex, gapLimit: current.gapLimit };
        gapLimitChanged = current.gapLimit !== scanned.gapLimit;
        if (gapLimitChanged) {
          this.queueRefresh('settings');
        }
      }
      const replayed = this.replay(txs, this.updatesFor(merged));
      if (!replayed) {
        // Reconciled by the live refresh, no sooner than LIVE_REFRESH_INTERVAL_MS after this scan.
        this.liveRefreshWanted = true;
      }
      this.storeView(buildWalletView(merged, replayed ?? txs, truncated));
      this.storeCache(merged.id, truncated || gapLimitChanged ? undefined : tip, txs);
    });
  }

  /** Live updates buffered during the current scan, cut down to the transactions that touch `wallet`. */
  private updatesFor(wallet: WatchWallet): LiveUpdate[] {
    const mine = addressMapOf(wallet);
    const touches = (tx: Transaction): boolean => (tx.vout || []).some((vout) => mine.has(vout.scriptpubkey_address))
      || (tx.vin || []).some((vin) => mine.has(vin.prevout?.scriptpubkey_address));
    return this.updatesDuringScan
      .map((update) => ({ added: update.added.filter(touches), removed: update.removed.filter(touches) }))
      .filter((update) => update.added.length || update.removed.length);
  }

  /** Applies buffered updates to a scan's result; null if they leave a conflict only a rescan settles. */
  private replay(txs: Transaction[], updates: LiveUpdate[]): Transaction[] | null {
    let history = txs;
    for (const update of updates) {
      history = applyLiveUpdate(history, update.added, update.removed);
      if (!history) {
        return null;
      }
    }
    return history;
  }

  /** Again after each scan, as a scan can derive more addresses than can be tracked. */
  private startTracking(): void {
    const view = this.state.view;
    // While the add-wallet form is open, the wallet behind it stays tracked.
    if (!view || view.wallet.id !== this.state.activeId) {
      return;
    }
    const id = view.wallet.id;
    // A truncated history isn't refreshed automatically, so it couldn't reconcile live updates
    // the server doesn't report, such as evictions.
    const addresses = view.truncated ? [] : trackedAddresses(view.wallet);
    const refused = addresses.length > 0 && this.refused.has(id);
    this.tracker.track(refused ? [] : addresses, {
      onUpdate: (update) => this.onLiveUpdate(id, update),
      onRefused: () => {
        this.refused.add(id);
        this.startTracking();
      },
    });
    const liveUpdates = refused ? 'refused' : addresses.length ? 'on' : 'off';
    if (this.state.liveUpdates !== liveUpdates) {
      this.patch({ liveUpdates });
    }
  }

  private onLiveUpdate(id: string, update: LiveUpdate): void {
    const view = this.state.view;
    if (!view || view.wallet.id !== id) {
      return;
    }
    if (this.state.scanning) {
      this.updatesDuringScan.push(update);
      this.liveRefreshWanted = true;
    } else {
      this.scheduleLiveRefresh();
    }
    const transactions = applyLiveUpdate(view.transactions, update.added, update.removed);
    // A conflict it can't resolve waits for the live refresh scheduled above.
    if (!transactions) {
      return;
    }
    const updated = buildWalletView(view.wallet, transactions, view.truncated);
    this.views.set(id, updated);
    this.patch({ view: updated });
  }

  /** Leaves the page idle for LIVE_REFRESH_INTERVAL_MS after a scan, however long the scan took. */
  private scheduleLiveRefresh(): void {
    this.liveRefreshTimer ??= setTimeout(() => {
      this.liveRefreshTimer = null;
      if (this.state.scanning) {
        this.liveRefreshWanted = true;
      } else {
        this.onChainChange(true);
      }
    }, Math.max(LIVE_REFRESH_DELAY_MS, this.lastScanEnd + LIVE_REFRESH_INTERVAL_MS - Date.now()));
  }

  private cancelLiveRefresh(): void {
    this.liveRefreshWanted = false;
    if (this.liveRefreshTimer) {
      clearTimeout(this.liveRefreshTimer);
      this.liveRefreshTimer = null;
    }
  }

  private storeCache(id: string, tip: BlockExtended | undefined, txs: Transaction[]): void {
    if (tip) {
      this.caches.set(id, { tipHash: tip.id, tipHeight: tip.height, confirmed: txs.filter((tx) => tx.status?.confirmed) });
    } else {
      this.caches.delete(id);
    }
  }

  private dropSessionState(id: string): void {
    this.views.delete(id);
    this.scannedAt.delete(id);
    this.caches.delete(id);
  }

  private storeView(view: WalletView): void {
    const { wallet } = view;
    const updatedAt = Math.floor(Date.now() / 1000);
    this.storage.save(wallet);
    this.views.set(wallet.id, view);
    this.scannedAt.set(wallet.id, updatedAt);
    const wallets = this.state.wallets.some((w) => w.id === wallet.id)
      ? this.state.wallets.map((w) => (w.id === wallet.id ? wallet : w))
      : [...this.state.wallets, wallet];
    this.patch({ wallets, view, updatedAt });
  }

  private updateWallet(wallet: WatchWallet): void {
    this.storage.save(wallet);
    const cached = this.views.get(wallet.id);
    const view = cached ? { ...cached, wallet } : null;
    if (view) {
      this.views.set(wallet.id, view);
    }
    this.patch({
      wallets: this.state.wallets.map((w) => (w.id === wallet.id ? wallet : w)),
      view: this.state.activeId === wallet.id ? view : this.state.view,
    });
  }
}
