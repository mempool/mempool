/**
 * Async Lock Implementation
 * Version: 4.0.0
 * Last updated: 2025-02-05
 * @josef edwards and @interchain.io
 */

export class AsyncLock {
  private locks: Map<string, Promise<void>>;
  private timeouts: Map<string, NodeJS.Timeout>;
  private readonly defaultTimeout: number = 30000; // 30 seconds

  constructor() {
    this.locks = new Map();
    this.timeouts = new Map();
  }

  async acquire(key: string, fn: () => Promise<void>, timeout: number = this.defaultTimeout): Promise<void> {
    // Wait for any existing lock to be released
    const existingLock = this.locks.get(key);
    if (existingLock) {
      await existingLock;
    }

    // Create and store new lock
    let resolve: () => void;
    let reject: (error: Error) => void;
    
    const newLock = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    this.locks.set(key, newLock);

    // Set timeout
    const timeoutId = setTimeout(() => {
      this.locks.delete(key);
      this.timeouts.delete(key);
      reject(new Error(`Lock acquisition timeout for key: ${key}`));
    }, timeout);

    this.timeouts.set(key, timeoutId);

    try {
      // Execute the protected code
      await fn();
      resolve!();
    } catch (error) {
      reject!(error instanceof Error ? error : new Error('Unknown error in lock'));
      throw error;
    } finally {
      // Cleanup
      clearTimeout(this.timeouts.get(key));
      this.timeouts.delete(key);
      this.locks.delete(key);
    }
  }

  async release(key: string): Promise<void> {
    const timeoutId = this.timeouts.get(key);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(key);
    }
    this.locks.delete(key);
  }

  isLocked(key: string): boolean {
    return this.locks.has(key);
  }

  clear(): void {
    this.timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.timeouts.clear();
    this.locks.clear();
  }
}
