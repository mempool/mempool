import { Injectable } from '@angular/core';
import { StateService } from '@app/services/state.service';
import { RequestCancelledError } from '@app/watch/api-retry';

export const ADDRESS_REQUEST_BURST = 15;
export const ADDRESS_REQUEST_REFILL_MS = 3_500;

export interface QueueOptions {
  isCancelled?: () => boolean;
}

export class RequestQueue {
  private tokens: number;
  private updatedAt: number;

  constructor(
    readonly capacity: number,
    readonly refillMs: number,
    private now: () => number = () => performance.now(),
    private sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {
    this.tokens = capacity;
    this.updatedAt = now();
  }

  get available(): number {
    this.refill();
    return this.tokens;
  }

  async take(options: QueueOptions = {}): Promise<void> {
    const { isCancelled } = options;
    for (;;) {
      if (isCancelled?.()) {
        throw new RequestCancelledError();
      }
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const left = (1 - this.tokens) * this.refillMs;
      await this.sleep(Math.min(left, 1000));
    }
  }

  private refill(): void {
    const now = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + Math.max(0, now - this.updatedAt) / this.refillMs);
    this.updatedAt = now;
  }
}

@Injectable({ providedIn: 'root' })
export class AddressRequestQueue {
  readonly queue: RequestQueue | null;

  constructor(stateService: StateService) {
    this.queue = stateService.env.OFFICIAL_MEMPOOL_SPACE ? new RequestQueue(ADDRESS_REQUEST_BURST, ADDRESS_REQUEST_REFILL_MS) : null;
  }
}
