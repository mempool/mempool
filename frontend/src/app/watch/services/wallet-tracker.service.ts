import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { BlockExtended } from '@interfaces/node-api.interface';

/**
 * Chain watching. It runs for the whole page, scans included, so a block found during a scan
 * is not missed.
 */
@Injectable()
export class WalletTrackerService implements OnDestroy {
  private chainSubscription = new Subscription();
  /** Newest first. */
  private blocks: BlockExtended[] = [];

  constructor(
    private stateService: StateService,
  ) {}

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
    this.chainSubscription.unsubscribe();
  }
}
