import { Injectable, OnDestroy } from '@angular/core';
import { filter, Subscription } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { WebsocketService } from '@app/services/websocket.service';
import { Transaction } from '@interfaces/electrs.interface';
import { BlockExtended } from '@interfaces/node-api.interface';
import { WatchWallet } from '@app/watch/watch.types';

/** The server tracks this many addresses per connection. */
const MAX_TRACKED = 10;

export interface LiveUpdate {
  added: Transaction[];
  /** Replaced, evicted or expired. */
  removed: Transaction[];
}

export interface TrackingCallbacks {
  onUpdate: (update: LiveUpdate) => void;
  onRefused: () => void;
}

/** Every address or none: tracking only some would miss payments to the rest without saying so. */
export function trackedAddresses(wallet: WatchWallet): string[] {
  return wallet.addresses.length <= MAX_TRACKED ? wallet.addresses.map((a) => a.address) : [];
}

/**
 * Address tracking over the websocket, and chain watching. Chain watching runs for the whole
 * page, scans included, so a block found during a scan is not missed.
 */
@Injectable()
export class WalletTrackerService implements OnDestroy {
  private chainSubscription = new Subscription();
  private trackingSubscription = new Subscription();
  /** Sorted, to tell a changed selection from a repeat. */
  private tracked: string | null = null;
  private callbacks: TrackingCallbacks | null = null;
  /** Newest first. */
  private blocks: BlockExtended[] = [];

  constructor(
    private stateService: StateService,
    private websocketService: WebsocketService,
  ) {}

  /**
   * A repeat of the current selection is not sent again, but takes the new callbacks: another
   * wallet can have the same addresses. No addresses stops tracking.
   */
  track(addresses: string[], callbacks: TrackingCallbacks): void {
    const key = [...addresses].sort().join(',');
    if (key === this.tracked) {
      this.callbacks = callbacks;
      return;
    }
    this.stop();
    if (!addresses.length) {
      return;
    }
    this.tracked = key;
    this.callbacks = callbacks;
    const request = this.websocketService.startTrackAddresses(addresses);
    const mine = new Set(addresses);
    // Only this request's refusal: one for an earlier selection can arrive after a switch.
    this.trackingSubscription.add(this.stateService.trackAddressesError$.pipe(filter((refused) => refused === request)).subscribe(() => {
      const refused = this.callbacks;
      // Also keeps the websocket service from replaying the refused request on reconnect.
      this.stop();
      refused?.onRefused();
    }));
    this.trackingSubscription.add(this.stateService.multiAddressTransactions$.subscribe((message) => {
      const added = new Map<string, Transaction>();
      const removed = new Map<string, Transaction>();
      for (const address of Object.keys(message).filter((a) => mine.has(a))) {
        const { mempool, confirmed, removed: gone } = message[address];
        [...(mempool || []), ...(confirmed || [])].forEach((tx) => added.set(tx.txid, tx));
        (gone || []).forEach((tx) => removed.set(tx.txid, tx));
      }
      if (added.size || removed.size) {
        this.callbacks?.onUpdate({ added: [...added.values()], removed: [...removed.values()] });
      }
    }));
  }

  /** Chain watching carries on. */
  stop(): void {
    if (this.tracked !== null) {
      this.websocketService.stopTrackingAddresses();
    }
    this.tracked = null;
    this.callbacks = null;
    this.trackingSubscription.unsubscribe();
    this.trackingSubscription = new Subscription();
  }

  get tip(): BlockExtended | undefined {
    return this.blocks[0];
  }

  /** Calls `onChange` on a new tip (block or reorg) and on reconnect, since anything could have happened meanwhile. */
  watchChain(onChange: () => void): void {
    this.chainSubscription.unsubscribe();
    this.chainSubscription = new Subscription();

    // blocks$ replays the current blocks on subscribe; the first emission only sets the baseline.
    this.chainSubscription.add(this.stateService.blocks$.subscribe((blocks) => {
      const before = this.blocks[0];
      this.blocks = [...blocks].sort((a, b) => b.height - a.height);
      const after = this.blocks[0];
      if (before && after && (before.height !== after.height || before.id !== after.id)) {
        onChange();
      }
    }));

    let connected = this.stateService.connectionState$.value === 2;
    this.chainSubscription.add(this.stateService.connectionState$.subscribe((state) => {
      if (state === 2 && !connected) {
        onChange();
      }
      connected = state === 2;
    }));
  }

  /** After a network change, so the new network's first blocks set a baseline rather than count as a change. */
  resetChain(): void {
    this.blocks = [];
  }

  ngOnDestroy(): void {
    this.stop();
    this.chainSubscription.unsubscribe();
  }
}
