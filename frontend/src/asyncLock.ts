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

/**
 * Async Lock Implementation
 * Advanced Asynchronous Resource Management
 * 
 * @version 5.0.0
 * @lastUpdated 2025-02-05 20:12:55
 * @author josefkedwards
 * 
 * Enhanced mutex implementation for asynchronous operations with:
 * - Timeout management
 * - Resource cleanup
 * - Debug logging
 * - Error handling
 * - Type safety
 * 
 * Features:
 * - Asynchronous lock acquisition and release
 * - Automatic timeout handling
 * - Resource cleanup on errors
 * - Comprehensive debug logging
 * - Manual lock management capabilities
 * - Performance optimized
 */

import { Logger } from '../utils/logger';

interface LockOptions {
  timeout?: number;
  logger?: Logger;
  debug?: boolean;
}

export class AsyncLock {
  private locks: Map<string, Promise<void>>;
  private timeouts: Map<string, NodeJS.Timeout>;
  private readonly defaultTimeout: number = 30000; // 30 seconds
  private readonly logger: Logger;
  private readonly debug: boolean;

  constructor(options?: LockOptions) {
    this.locks = new Map();
    this.timeouts = new Map();
    this.logger = options?.logger || console;
    this.debug = options?.debug ?? false;
  }

  /**
   * Acquires a lock for the given key and executes the provided async function.
   * If the lock is already held, waits until it is released.
   *
   * @param key - The key for which to acquire the lock
   * @param fn - An async function to execute while holding the lock
   * @param timeout - Optional timeout in milliseconds (defaults to 30 seconds)
   * @throws Error if the lock acquisition times out or if the function execution fails
   */
  async acquire(
    key: string,
    fn: () => Promise<void>,
    timeout: number = this.defaultTimeout
  ): Promise<void> {
    // Wait for any existing lock to be released
    const existingLock = this.locks.get(key);
    if (existingLock) {
      this.logDebug(`Waiting for existing lock on key "${key}"...`);
      await existingLock;
    }

    // Create new lock promise with explicit resolve/reject types
    let resolveFn!: () => void;
    let rejectFn!: (error: Error) => void;
    const newLock = new Promise<void>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });

    this.locks.set(key, newLock);
    this.logDebug(`Lock acquired for key "${key}"`);

    // Set a timeout to automatically reject the lock if it takes too long
    const timeoutId = setTimeout(() => {
      this.locks.delete(key);
      this.timeouts.delete(key);
      const err = new Error(`Lock acquisition timeout for key: ${key}`);
      this.logger.error(`[AsyncLock] ${err.message}`);
      rejectFn(err);
    }, timeout);

    this.timeouts.set(key, timeoutId);

    try {
      // Execute the protected function
      await fn();
      this.logDebug(`Function executed successfully for key "${key}"`);
      resolveFn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error in lock');
      this.logger.error(`[AsyncLock] Error during locked function for key "${key}":`, err);
      rejectFn(err);
      throw err;
    } finally {
      // Cleanup: clear the timeout and remove the lock and its timeout entry
      this.cleanup(key);
    }
  }

  /**
   * Releases the lock for a given key manually.
   * This is rarely needed since acquire() cleans up automatically.
   *
   * @param key - The key for which to release the lock
   */
  async release(key: string): Promise<void> {
    this.cleanup(key);
    this.logDebug(`Lock manually released for key "${key}"`);
  }

  /**
   * Checks whether a lock for the given key is currently held.
   *
   * @param key - The key to check
   * @returns boolean indicating if the key is currently locked
   */
  isLocked(key: string): boolean {
    return this.locks.has(key);
  }

  /**
   * Clears all locks and timeouts.
   * Use with caution - this will forcibly release all locks.
   */
  clear(): void {
    this.timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.timeouts.clear();
    this.locks.clear();
    this.logDebug('All locks and timeouts cleared');
  }

  /**
   * Internal cleanup method to handle lock and timeout cleanup
   * @private
   */
  private cleanup(key: string): void {
    const timeoutId = this.timeouts.get(key);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(key);
    }
    this.locks.delete(key);
    this.logDebug(`Cleanup completed for key "${key}"`);
  }

  /**
   * Internal debug logging method
   * @private
   */
  private logDebug(message: string): void {
    if (this.debug) {
      this.logger.debug(`[AsyncLock] ${message}`);
    }
  }

  /**
   * Returns the current number of active locks
   * @returns number of active locks
   */
  get activeLocks(): number {
    return this.locks.size;
  }
}

/**
 * Usage Example:
 * 
 * ```typescript
 * const lock = new AsyncLock({
 *   timeout: 5000,    // 5 second timeout
 *   debug: true,      // Enable debug logging
 *   logger: console   // Use custom logger
 * });
 * 
 * async function criticalSection() {
 *   console.log("Entering critical section...");
 *   await new Promise(res => setTimeout(res, 1000));
 *   console.log("Exiting critical section...");
 * }
 * 
 * // Sequential execution
 * await lock.acquire("resource1", criticalSection);
 * 
 * // Parallel execution with different keys
 * await Promise.all([
 *   lock.acquire("resource1", criticalSection),
 *   lock.acquire("resource2", criticalSection)
 * ]);
 * ```
 */

/**
 * AI-PoW-R Mining Implementation
 * Version: 5.0.0
 * Last updated: 2025-02-05
 * @josef edwards and @interchain.io
 */

import { createHash } from 'crypto';
import { Worker } from 'worker_threads';
import os from 'os';
import path from 'path';
import logger from '../logger';
import { AIPoWRResult } from '../types/mining';
import config from '../config';

interface WorkerMessage {
  hash: string;
  nonce: number;
  timestamp: number;
  difficulty: number;
}

/**
 * AIPoWRMiner distributes mining work among worker threads.
 */
export class AIPoWRMiner {
  private readonly workers: Worker[] = [];
  private readonly maxNonce: number = Number.MAX_SAFE_INTEGER;
  private readonly maxThreads: number;

  constructor() {
    // Use provided threads count or default to number of CPU cores.
    this.maxThreads = config.MINING.AI_POWR.THREADS || os.cpus().length;
    this.initializeWorkers();
  }

  /**
   * Initializes the worker threads.
   */
  private initializeWorkers(): void {
    for (let i = 0; i < this.maxThreads; i++) {
      // Assumes the worker file is located at the same level as this file in a file named 'ai-powr-worker.js'
      const worker = new Worker(path.resolve(__dirname, 'ai-powr-worker.js'));
      worker.on('error', (error) => {
        logger.error(`Worker ${i} error:`, error);
      });
      worker.on('exit', (code) => {
        if (code !== 0) {
          logger.error(`Worker ${i} stopped with exit code ${code}`);
        }
      });
      this.workers.push(worker);
    }
  }

  /**
   * Starts mining by distributing work to all available workers.
   * Resolves with the first successful result.
   *
   * @param blockData The block data to mine.
   * @param targetDifficulty The difficulty target; defaults to 1.
   */
  async mine(blockData: string, targetDifficulty: number = 1): Promise<AIPoWRResult> {
    const startTime = Date.now();

    // Validate input blockData.
    if (!this.validateBlockData(blockData)) {
      throw new Error('Invalid block data');
    }

    // Check that the target difficulty is within allowed limits.
    if (targetDifficulty > config.MINING.AI_POWR.MAX_DIFFICULTY) {
      throw new Error('Target difficulty too high');
    }

    try {
      // Distribute work among workers and wait for the first result.
      const promises = this.workers.map((worker, index) => {
        return new Promise<AIPoWRResult>((resolve, reject) => {
          // Define a one-time message handler.
          const messageHandler = (result: WorkerMessage) => {
            resolve({
              ...result,
              elapsed: Date.now() - startTime,
            });
          };
          worker.once('message', messageHandler);
          worker.once('error', reject);

          // Calculate the starting nonce for this worker.
          const startNonce = Math.floor(this.maxNonce / this.maxThreads) * index;
          worker.postMessage({
            blockData,
            targetDifficulty,
            startNonce,
          });
        });
      });

      // Use Promise.race to return the first successful mining result.
      const result = await Promise.race(promises);

      // Send a "stop" command to all workers.
      this.workers.forEach((worker) => worker.postMessage({ stop: true }));

      return result;
    } catch (error) {
      logger.error('Mining error:', error);
      throw new Error('Mining failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Validates the block data. Must be a hexadecimal string of reasonable length.
   *
   * @param blockData The block data to validate.
   */
  private validateBlockData(blockData: string): boolean {
    if (!blockData || typeof blockData !== 'string') {
      return false;
    }
    if (blockData.length < 64 || blockData.length > 1024) {
      return false;
    }
    const hexRegex = /^[0-9a-fA-F]+$/;
    return hexRegex.test(blockData);
  }

  /**
   * Calculates a SHA-256 hash of the provided data.
   *
   * @param data The data to hash.
   */
  private calculateHash(data: string): string {
    return createHash('sha256')
      .update(Buffer.from(data, 'hex'))
      .digest('hex');
  }

  /**
   * Checks whether the hash meets the target difficulty.
   *
   * @param hash The computed hash.
   * @param targetDifficulty The difficulty target.
   */
  private checkDifficulty(hash: string, targetDifficulty: number): boolean {
    // Convert the first 8 characters of the hash from hex to number.
    const difficulty = parseInt(hash.substring(0, 8), 16);
    return difficulty <= (2 ** 32) / targetDifficulty;
  }

  /**
   * Terminates all worker threads.
   */
  public async stop(): Promise<void> {
    await Promise.all(this.workers.map(worker => worker.terminate()));
    this.workers.length = 0;
    logger.info('All mining workers terminated.');
  }
}

/* ============================================================================
   Usage Simulation:

   const miner = new AIPoWRMiner();
   miner.mine('abcdef0123456789...') // supply valid hex blockData and optionally a targetDifficulty
     .then(result => {
       console.log('Mining success:', result);
     })
     .catch(error => {
       console.error('Mining error:', error);
     });
============================================================================= */
