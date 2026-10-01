import { createHash } from 'crypto';
import config from '../config';
import logger from '../logger';
import bitcoinClient from './bitcoin/bitcoin-client';
import AddressTxsRepository, { AddressTxRow } from '../repositories/AddressTxsRepository';

interface VerboseBlock {
  height: number;
  time: number;
  tx: {
    txid: string;
    vin: { prevout?: { value: number, scriptPubKey: { hex: string } } }[];
    vout: { value: number, scriptPubKey: { hex: string } }[];
  }[];
}

class AddressTxsIndexer {
  private running = false;
  private reorgDetected = false;
  private pendingInsert: Promise<void> = Promise.resolve();

  public isEnabled(): boolean {
    return config.MEMPOOL.BACKEND === 'esplora' && config.CLICKHOUSE.ENABLED === true && !['liquid', 'liquidtestnet'].includes(config.MEMPOOL.NETWORK);
  }

  /** @asyncSafe */
  public async $run(): Promise<void> {
    if (!this.isEnabled() || this.running) {
      return;
    }
    this.running = true;
    this.reorgDetected = false;

    try {
      let tipHeight: number = await bitcoinClient.getBlockCount();
      const range = await AddressTxsRepository.$getIndexedRange();
      let nextNewHeight = range ? range.max + 1 : tipHeight;
      let nextOldHeight = range ? range.min - 1 : tipHeight - 1;

      let indexedThisRun = 0;
      let indexedSinceLastLog = 0;
      let timer = Date.now() / 1000;
      const startedAt = Date.now() / 1000;

      while (nextNewHeight <= tipHeight || nextOldHeight >= 0) {
        const height = nextNewHeight <= tipHeight ? nextNewHeight : nextOldHeight;
        const rows = await this.$getBlockRows(height);

        if (this.reorgDetected) {
          logger.info(`Address txs indexing stopped at block #${height} because of a reorg`);
          break;
        }
        this.pendingInsert = AddressTxsRepository.$saveBlockRows(rows);
        await this.pendingInsert;

        if (height === nextNewHeight) {
          nextNewHeight++;
        } else {
          nextOldHeight--;
        }
        tipHeight = await bitcoinClient.getBlockCount();

        indexedThisRun++;
        indexedSinceLastLog++;
        const elapsedSeconds = (Date.now() / 1000) - timer;
        if (elapsedSeconds > 5) {
          const runningFor = (Date.now() / 1000) - startedAt;
          const blocksPerSecond = indexedSinceLastLog / elapsedSeconds;
          const indexedBlocks = nextNewHeight - nextOldHeight - 1;
          const progress = Math.round(indexedBlocks / (tipHeight + 1) * 10000) / 100;
          logger.debug(`Indexing address txs for #${height} | ~${blocksPerSecond.toFixed(2)} blocks/sec | ${indexedBlocks}/${tipHeight + 1} blocks (${progress}%) | elapsed: ${runningFor.toFixed(2)} seconds`, logger.tags.analytics);
          timer = Date.now() / 1000;
          indexedSinceLastLog = 0;
        }
      }

      if (indexedThisRun > 0) {
        logger.notice(`Address txs indexing completed: indexed ${indexedThisRun} blocks`);
      }
    } catch (e) {
      logger.err(`Address txs indexing failed, it will resume on the next indexer run. Reason: ` + (e instanceof Error ? e.message : e));
    } finally {
      this.running = false;
    }
  }

  /** @asyncSafe */
  public async $handleReorg(forkHeight: number): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }
    this.reorgDetected = true;
    try {
      // wait for an in-flight insert so the delete also removes it
      await this.pendingInsert.catch(() => undefined);
      await AddressTxsRepository.$deleteFromHeight(forkHeight);
      logger.info(`Deleted address txs from block #${forkHeight} because of a reorg`);
    } catch (e) {
      logger.err(`Could not delete address txs from block #${forkHeight} after a reorg. Reason: ` + (e instanceof Error ? e.message : e));
    }
  }

  /** @asyncUnsafe */
  private async $getBlockRows(height: number): Promise<AddressTxRow[]> {
    const hash: string = await bitcoinClient.getBlockHash(height);
    const block: VerboseBlock = await bitcoinClient.getBlock(hash, 3);

    const rows: AddressTxRow[] = [];
    block.tx.forEach((tx, position) => {
      const netValues = new Map<string, number>();
      for (const vin of tx.vin) {
        if (vin.prevout) {
          this.addValue(netValues, vin.prevout.scriptPubKey.hex, -this.toSats(vin.prevout.value));
        }
      }
      for (const vout of tx.vout) {
        this.addValue(netValues, vout.scriptPubKey.hex, this.toSats(vout.value));
      }

      for (const [scripthash, netValue] of netValues) {
        rows.push({
          scripthash,
          txid: tx.txid,
          tx_position: position,
          block_height: block.height,
          block_timestamp: block.time,
          net_value: netValue,
        });
      }
    });
    return rows;
  }

  private addValue(netValues: Map<string, number>, scriptHex: string, sats: number): void {
    // OP_RETURN
    if (scriptHex.startsWith('6a')) {
      return;
    }
    const scripthash = createHash('sha256').update(new Uint8Array(Buffer.from(scriptHex, 'hex'))).digest('hex');
    netValues.set(scripthash, (netValues.get(scripthash) ?? 0) + sats);
  }

  private toSats(btc: number): number {
    if (!Number.isFinite(btc)) {
      throw new Error(`Invalid amount: ${btc}`);
    }
    return Math.round(btc * 100_000_000);
  }
}

export default new AddressTxsIndexer();
