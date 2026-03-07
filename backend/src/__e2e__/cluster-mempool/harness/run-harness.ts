/**
 * Cluster Mempool Test Harness
 *
 * Standalone script that compares our ClusterMempool block template ordering
 * against Bitcoin Core's getblocktemplate output.
 *
 * Uses the backend's own transactionUtils to fetch and convert transactions,
 * ensuring fields (sigops, adjustedVsize, etc.) match exactly.
 *
 * Usage:
 *   npx ts-node src/__tests__/cluster-mempool/harness/run-harness.ts [options]
 *
 * Options:
 *   --host <host>       Override CORE_RPC host
 *   --port <port>       Override CORE_RPC port
 *   --user <user>       Override CORE_RPC username
 *   --pass <pass>       Override CORE_RPC password
 *   --interval <ms>     Comparison interval in ms (default: 30000)
 *   --poll <ms>         Mempool poll interval in ms (default: 1000)
 *   --max <n>           Max comparisons before exit (0 = unlimited, default: 0)
 */

import { RpcClient, RpcConfig } from './rpc-client';

// ─── CLI Parsing (must happen before backend imports) ───────────────────────

interface CliOptions {
  rpcOverrides: Partial<RpcConfig>;
  comparisonInterval: number;
  pollInterval: number;
  maxComparisons: number;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const overrides: Partial<RpcConfig> = {};
  let comparisonInterval = 30_000;
  let pollInterval = 1000;
  let maxComparisons = 0;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--host':
        overrides.host = args[++i];
        break;
      case '--port':
        overrides.port = parseInt(args[++i], 10);
        break;
      case '--user':
        overrides.user = args[++i];
        break;
      case '--pass':
        overrides.pass = args[++i];
        break;
      case '--interval':
        comparisonInterval = parseInt(args[++i], 10);
        break;
      case '--poll':
        pollInterval = parseInt(args[++i], 10);
        break;
      case '--max':
        maxComparisons = parseInt(args[++i], 10);
        break;
    }
  }

  return { rpcOverrides: overrides, comparisonInterval, pollInterval, maxComparisons };
}

const cliOptions = parseArgs();

// ─── Backend Module Loading ─────────────────────────────────────────────────
// Import config first, apply CLI overrides, then import modules that depend on it.
// This works because Node's require() caches modules — when transactionUtils
// (via bitcoinClient) reads config, it sees our modified values.

const config = require('../../../config').default;

if (cliOptions.rpcOverrides.host) { config.CORE_RPC.HOST = cliOptions.rpcOverrides.host; }
if (cliOptions.rpcOverrides.port) { config.CORE_RPC.PORT = cliOptions.rpcOverrides.port; }
if (cliOptions.rpcOverrides.user) { config.CORE_RPC.USERNAME = cliOptions.rpcOverrides.user; }
if (cliOptions.rpcOverrides.pass) { config.CORE_RPC.PASSWORD = cliOptions.rpcOverrides.pass; }

// Now load modules that depend on config
const bitcoinApi = require('../../../api/bitcoin/bitcoin-api-factory').default;
const transactionUtils = require('../../../api/transaction-utils').default;
const { ClusterMempool } = require('../../../cluster-mempool/cluster-mempool');

import { MempoolTransactionExtended } from '../../../mempool.interfaces';
import { MempoolDiff } from '../../../cluster-mempool/cluster-mempool';

// ─── Main Harness ───────────────────────────────────────────────────────────

const TX_FETCH_BATCH_SIZE = 1000;

class Harness {
  private rpc: RpcClient;
  private clusterMempool: InstanceType<typeof ClusterMempool> | null = null;
  private mempool: { [txid: string]: MempoolTransactionExtended } = {};
  private knownTxids = new Set<string>();
  private lastBlockHeight = -1;
  private comparisonInterval: number;
  private pollInterval: number;
  private maxComparisons: number;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private nextComparisonTime = 0;
  private stats = {
    templateMatches: 0,
    templateMismatches: 0,
    comparisons: 0,
  };

  constructor(rpcConfig: RpcConfig, opts: CliOptions) {
    this.rpc = new RpcClient(rpcConfig);
    this.comparisonInterval = opts.comparisonInterval;
    this.pollInterval = opts.pollInterval;
    this.maxComparisons = opts.maxComparisons;
  }

  async run(): Promise<void> {
    console.log('=== Cluster Mempool Test Harness ===');
    console.log(`RPC: ${config.CORE_RPC.HOST}:${config.CORE_RPC.PORT}`);
    console.log(`Backend: ${config.MEMPOOL.BACKEND}`);
    console.log(`Poll interval: ${this.pollInterval}ms`);
    console.log(`Comparison interval: ${this.comparisonInterval}ms`);
    console.log();

    // Step 1: Fetch full mempool
    console.log('Fetching full mempool...');
    const txids: string[] = await bitcoinApi.$getRawMempool();
    console.log(`Got ${txids.length} txids from getrawmempool`);

    const fetchStart = Date.now();
    await this.fetchTransactions(txids);
    const fetchTime = Date.now() - fetchStart;
    console.log(`Fetched ${Object.keys(this.mempool).length} transactions in ${fetchTime}ms`);

    // Step 2: Initialize ClusterMempool
    console.log('Building cluster mempool...');
    const buildStart = Date.now();
    this.clusterMempool = new ClusterMempool(this.mempool);
    const buildTime = Date.now() - buildStart;
    console.log(`Cluster mempool built in ${buildTime}ms`);
    console.log(`  Clusters: ${this.clusterMempool.getClusterCount()}`);
    console.log(`  Transactions: ${this.clusterMempool.getTxCount()}`);
    console.log();

    // Record initial block height
    this.lastBlockHeight = await this.rpc.getBlockCount();

    // Run initial comparison, then start polling
    await this.runComparison();
    this.nextComparisonTime = Date.now() + this.comparisonInterval;
    this.pollTimer = setInterval(() => this.pollMempool(), this.pollInterval);

    console.log('\nHarness running. Press Ctrl+C to stop.\n');

    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  private async fetchTransactions(txids: string[]): Promise<MempoolTransactionExtended[]> {
    const added: MempoolTransactionExtended[] = [];

    for (let offset = 0; offset < txids.length; offset += TX_FETCH_BATCH_SIZE) {
      let batch = txids.slice(offset, offset + TX_FETCH_BATCH_SIZE);
      let txs: MempoolTransactionExtended[] = [];
      let tries = 0;
      while (batch.length && tries < 20) {
        try {
          tries++;
          txs = txs.concat(await transactionUtils.$getMempoolTransactionsExtended(batch, false, false, false));
          let missing: string[] = [];
          console.log(`txs: ${txs.length} of ${batch.length} fetched`);
          for (const txid of batch) {
            if (!txs.some(tx => tx.txid === txid)) {
              console.log(`missing ${txid} at offset ${offset}, retrying`);
              missing.push(txid);
            }
          }
          batch = missing;
          if (batch.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (err: any) {
          console.log(`  Fetch batch failed at offset ${offset}: ${err.message}, retrying`);
        }
      }

      for (const tx of txs) {
        this.mempool[tx.txid] = tx;
        this.knownTxids.add(tx.txid);
        added.push(tx);
      }

      if (txids.length > TX_FETCH_BATCH_SIZE && (offset + batch.length) % 5000 < TX_FETCH_BATCH_SIZE) {
        console.log(`  ${offset + batch.length} / ${txids.length} fetched...`);
      }
    }

    return added;
  }

  private async pollMempool(): Promise<void> {
    if (this.polling || !this.clusterMempool) {
      return;
    }
    this.polling = true;

    try {
      // Check for new block
      const height = await this.rpc.getBlockCount();
      const newBlock = height > this.lastBlockHeight;
      if (newBlock) {
        console.log(`\n--- New block detected (height ${height}) ---`);
        this.lastBlockHeight = height;
      }

      // Get current mempool
      const currentTxids = await bitcoinApi.$getRawMempool();
      const currentSet = new Set(currentTxids);

      // Find added and removed
      const addedTxids: string[] = [];
      for (const txid of currentTxids) {
        if (!this.knownTxids.has(txid)) {
          addedTxids.push(txid);
        }
      }
      const removedTxids: string[] = [];
      for (const txid of this.knownTxids) {
        if (!currentSet.has(txid)) {
          removedTxids.push(txid);
        }
      }

      if (addedTxids.length === 0 && removedTxids.length === 0) {
        if (newBlock) {
          await this.runComparison();
        }
        return;
      }

      const added = await this.fetchTransactions(addedTxids);

      // Apply diff before deleting from cache — processRemovals needs the tx data
      const diff: MempoolDiff = { added, removed: removedTxids, accelerations: {} };
      const t0 = Date.now();
      this.clusterMempool.applyMempoolChange(diff);
      const dt = Date.now() - t0;
      for (const txid of removedTxids) {
        delete this.mempool[txid];
        this.knownTxids.delete(txid);
      }
      console.log(
        `Applied${newBlock ? ' block' : ''} diff: +${added.length} -${removedTxids.length} txs in ${dt}ms` +
        ` (${this.clusterMempool.getTxCount()} txs, ${this.clusterMempool.getClusterCount()} clusters)`
      );

      if (newBlock) {
        await this.runComparison();
      } else if (Date.now() >= this.nextComparisonTime) {
        await this.runComparison();
        this.nextComparisonTime = Date.now() + this.comparisonInterval;
      }
    } catch (err: any) {
      console.error(`Poll error: ${err.message}`);
    } finally {
      this.polling = false;
    }
  }

  private async runComparison(): Promise<void> {
    if (!this.clusterMempool) {
      return;
    }
    this.stats.comparisons++;
    console.log(`\n=== Comparison #${this.stats.comparisons} ===`);

    // Step 1: Get Core's block template
    let template: any;
    try {
      template = await this.rpc.getBlockTemplate(['segwit']);
    } catch (err: any) {
      console.log(`getblocktemplate failed: ${err.message}`);
      return;
    }
    const coreTxids: string[] = template.transactions.map((t: any) => t.txid);
    const coreSet = new Set(coreTxids);

    const missingTxids: string[] = [];
    for (const txid of coreSet) {
      if (!this.mempool[txid]) {
        missingTxids.push(txid);
      }
    }
    if (missingTxids.length) {
      const added = await this.fetchTransactions(missingTxids);
      if (added.length) {
        console.log(`Reconciled: +${added.length} missing txs`);
        this.clusterMempool.applyMempoolChange({ added, removed: [], accelerations: {} });
      }
    }

    const ourBlocks = this.clusterMempool.getBlocks(1, true);
    const ourTxids: string[] = ourBlocks[0]?.txids || [];

    await this.compareTemplateOrdering(coreTxids, ourTxids);

    this.printStats();

    if (this.maxComparisons > 0 && this.stats.comparisons >= this.maxComparisons) {
      console.log(`\nReached ${this.maxComparisons} comparisons, stopping.`);
      this.shutdown();
    }
  }

  private async compareTemplateOrdering(coreTxids: string[], ourTxids: string[]): Promise<void> {
    const coreSet = new Set(coreTxids);
    const ourSet = new Set(ourTxids);

    let inBoth = 0;
    let onlyCore = 0;
    let onlyOurs = 0;
    for (const txid of coreSet) {
      if (ourSet.has(txid)) {
        inBoth++;
      } else {
        onlyCore++;
      }
    }
    for (const txid of ourSet) {
      if (!coreSet.has(txid)) {
        onlyOurs++;
      }
    }

    console.log(`Template sets: Core ${coreTxids.length} txs, Ours ${ourTxids.length} txs`);
    console.log(`  In both: ${inBoth}, Only Core: ${onlyCore}, Only ours: ${onlyOurs}`);

    // Build position maps for the intersection
    const corePos = new Map<string, number>();
    for (let i = 0; i < coreTxids.length; i++) {
      if (ourSet.has(coreTxids[i])) {
        corePos.set(coreTxids[i], i);
      }
    }

    // Filter to shared txids in each order
    const sharedInCoreOrder = coreTxids.filter(t => ourSet.has(t));
    const sharedInOurOrder = ourTxids.filter(t => coreSet.has(t));

    let exactMatches = 0;
    let firstDivergence = -1;
    for (let i = 0; i < sharedInCoreOrder.length; i++) {
      if (sharedInCoreOrder[i] === sharedInOurOrder[i]) {
        exactMatches++;
      } else if (firstDivergence === -1) {
        firstDivergence = i;
      }
    }

    const orderMatchRate = sharedInCoreOrder.length > 0
      ? (exactMatches / sharedInCoreOrder.length * 100).toFixed(1)
      : 'N/A';
    console.log(`  Ordering: ${orderMatchRate}% exact position match (${exactMatches}/${sharedInCoreOrder.length} shared txs)`);

    if (firstDivergence >= 0) {
      const coreTx = sharedInCoreOrder[firstDivergence];
      const ourTx = sharedInOurOrder[firstDivergence];
      console.log(`\n  First divergence at position ${firstDivergence}:`);
      console.log(`    Core wants: ${coreTx}`);
      console.log(`    We placed:  ${ourTx} (Core has this at position ${corePos.get(ourTx)})`);

      for (const [label, txid] of [['Core tx', coreTx], ['Our tx', ourTx]] as const) {
        const inOurMempool = !!this.mempool[txid];
        const info = this.clusterMempool?.getClusterInfo(txid);
        console.log(`\n    --- ${label}: ${txid} ---`);
        console.log(`    In our mempool: ${inOurMempool}`);
        if (inOurMempool) {
          const tx = this.mempool[txid];
          console.log(`    fee=${tx.fee} weight=${tx.weight} vsize=${tx.vsize} sigops=${tx.sigops} adjustedVsize=${tx.adjustedVsize}`);
        }
        if (info) {
          console.log(`    clusterId=${info.clusterId} chunkIndex=${info.chunkIndex} chunkFeerate=${info.chunkFeerate.toFixed(6)}`);
          const cluster = this.clusterMempool?.getCluster(info.clusterId);
          if (cluster) {
            console.log(`    Cluster has ${cluster.chunks.length} chunk(s):`);
            for (let ci = 0; ci < cluster.chunks.length; ci++) {
              const c = cluster.chunks[ci];
              console.log(`      chunk[${ci}]: ${c.txs.length} txs, feerate=${c.feerate.toFixed(6)}`);
              if (ci === info.chunkIndex) {
                const chunkTxids = c.txs.map((idx: number) => cluster.txs[idx]?.txid).filter(Boolean);
                for (const tid of chunkTxids) {
                  const t = this.mempool[tid];
                  const parents = t?.vin
                    ?.filter(v => !v.is_coinbase && this.mempool[v.txid] && chunkTxids.includes(v.txid))
                    .map(v => v.txid.substring(0, 12)) || [];
                  console.log(`        ${tid.substring(0, 12)}  fee=${t?.fee} size=${(t?.weight || 0) / 4} sigops=${t?.sigops} parents=[${parents.join(', ')}]`);
                }
              }
            }
          }
        } else {
          console.log(`    NOT in our cluster mempool`);
        }
      }

      for (const [label, txid] of [['Core', coreTx], ['Our', ourTx]] as const) {
        try {
          const coreCluster = await this.rpc.getMempoolCluster(txid);
          console.log(`\n    --- Core cluster for ${label} tx ${txid.substring(0, 12)} ---`);
          console.log(`    Raw response: ${JSON.stringify(coreCluster).substring(0, 2000)}`);
        } catch (e: any) {
          console.log(`    Failed to get Core cluster for ${label} tx: ${e.message}`);
        }
      }

      this.stats.templateMismatches++;
    } else if (sharedInCoreOrder.length === coreTxids.length && sharedInCoreOrder.length === ourTxids.length) {
      console.log(`  PERFECT MATCH`);
      this.stats.templateMatches++;
    } else {
      console.log(`  Ordering matches for shared txs, but sets differ`);
      this.stats.templateMatches++;
    }
  }

  private printStats(): void {
    console.log('\n--- Cumulative Stats ---');
    const total = this.stats.templateMatches + this.stats.templateMismatches;
    console.log(`Template comparisons: ${total} (${this.stats.templateMatches} perfect, ${this.stats.templateMismatches} divergent)`);
  }

  private shutdown(): void {
    console.log('\nShutting down...');
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
    this.printStats();
    process.exit(0);
  }
}

// ─── Entry Point ────────────────────────────────────────────────────────────

const rpcConfig: RpcConfig = {
  host: config.CORE_RPC.HOST,
  port: config.CORE_RPC.PORT,
  user: config.CORE_RPC.USERNAME,
  pass: config.CORE_RPC.PASSWORD,
};

console.log(`Connecting to Bitcoin Core at ${rpcConfig.host}:${rpcConfig.port}`);

const harness = new Harness(rpcConfig, cliOptions);
harness.run().catch((err) => {
  console.error('Harness failed:', err);
  process.exit(1);
});
