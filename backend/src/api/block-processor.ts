import config from '../config';
import logger from '../logger';
import {
  BlockExtended,
  BlockSummary,
  PoolTag,
  MempoolTransactionExtended,
  CpfpSummary,
  TemplateAlgorithm,
  MempoolBlockWithTransactions,
} from '../mempool.interfaces';
import { IEsploraApi } from './bitcoin/esplora-api.interface';
import { Acceleration } from './services/acceleration';
import { calculateGoodBlockCpfp, calculateClusterMempoolBlockCpfp, calculateFastBlockCpfp, BlockCpfpData } from './cpfp';
import mempoolBlocks from './mempool-blocks';
import memPool from './mempool';
import Audit, { AuditResult } from './audit';
import blocks from './blocks';
import transactionUtils from './transaction-utils';
import { ClusterMempool } from '../cluster-mempool/cluster-mempool';
import { Common } from './common';
import accelerationApi from './services/acceleration';

interface ProcessedAudit extends AuditResult {
  expectedFees: number;
  expectedWeight: number;
  projectedBlocks: MempoolBlockWithTransactions[];
}

export interface BlockProcessingResult {
  templateAlgorithm: TemplateAlgorithm;
  cpfpSummary: CpfpSummary;
  blockExtended: BlockExtended;
  blockSummary: BlockSummary;
  auditResult?: ProcessedAudit;
}

const CM_ACTIVATION_HEIGHT: { [network: string]: number } = {
  'mainnet': 940000,
  'testnet': 4860000,
  'testnet4': 125000,
  'signet': 294000,
  'regtest': 0,
};

class BlockProcessor {

  /** @asyncUnsafe */
  public async $processNewBlock(
    block: IEsploraApi.Block,
    transactions: MempoolTransactionExtended[],
    pool: PoolTag,
    accelerations: Record<string, Acceleration>
  ): Promise<BlockProcessingResult> {
    const poolAccelerations = Object.values(accelerations)
      .filter(a => a.pools.includes(pool.uniqueId))
      .map(a => ({ txid: a.txid, max_bid: a.feeDelta }));

    const { templateAlgorithm, cpfpSummary } = detectTemplateAlgorithm(
      block.height,
      transactions,
      poolAccelerations
    );


    const blockExtended = await blocks.$getBlockExtended(block, cpfpSummary.transactions, pool);
    const blockSummary = blocks.summarizeBlockTransactions(block.id, block.height, cpfpSummary.transactions);

    let auditResult: ProcessedAudit | undefined;
    if (config.MEMPOOL.AUDIT && memPool.isInSync()) {
      auditResult = await this.$runAudit(
        blockExtended,
        transactions,
        templateAlgorithm,
        pool,
        accelerations
      );

      if (blockExtended.extras) {
        blockExtended.extras.matchRate = auditResult.matchRate;
        blockExtended.extras.expectedFees = auditResult.expectedFees;
        blockExtended.extras.expectedWeight = auditResult.expectedWeight;
        blockExtended.extras.similarity = auditResult.similarity;
      }
    } else if (blockExtended.extras) {
      const mBlocks = mempoolBlocks.getMempoolBlocksWithTransactions();
      if (mBlocks?.length && mBlocks[0].transactions) {
        blockExtended.extras.similarity = Common.getSimilarity(mBlocks[0], transactions);
      }
    }

    return {
      templateAlgorithm,
      cpfpSummary,
      blockExtended,
      blockSummary,
      auditResult,
    };
  }

  private async $runAudit(
    block: BlockExtended,
    transactions: MempoolTransactionExtended[],
    templateAlgorithm: TemplateAlgorithm,
    pool: PoolTag,
    accelerations: Record<string, Acceleration>
  ): Promise<ProcessedAudit> {
    const auditMempool = memPool.getMempool();
    const isAccelerated = accelerationApi.isAcceleratedBlock(block, Object.values(accelerations));

    const candidateTxs = memPool.getMempoolCandidates();
    const candidates = (memPool.limitGBT && candidateTxs)
      ? { txs: candidateTxs, added: [], removed: [] }
      : undefined;
    const transactionIds = (memPool.limitGBT)
      ? Object.keys(candidates?.txs || {})
      : Object.keys(auditMempool);

    let projectedBlocks: MempoolBlockWithTransactions[];

    if (templateAlgorithm === TemplateAlgorithm.clusterMempool) {
      const clusterMempool = memPool.clusterMempool ?? new ClusterMempool(auditMempool, accelerations, true, 75000);
      const cmBlocks = clusterMempool.getBlocks(config.MEMPOOL.MEMPOOL_BLOCKS_AMOUNT) ?? [];
      projectedBlocks = mempoolBlocks.processClusterMempoolBlocks(
        cmBlocks,
        auditMempool,
        accelerations,
        false,
        pool.uniqueId
      );
    } else if (config.MEMPOOL.RUST_GBT) {
      const added = memPool.limitGBT ? (candidates?.added || []) : [];
      const removed = memPool.limitGBT ? (candidates?.removed || []) : [];
      projectedBlocks = await mempoolBlocks.$rustUpdateBlockTemplates(
        transactionIds,
        auditMempool,
        added,
        removed,
        candidates,
        isAccelerated,
        pool.uniqueId,
        true
      );
    } else {
      projectedBlocks = await mempoolBlocks.$makeBlockTemplates(
        transactionIds,
        auditMempool,
        candidates,
        false,
        isAccelerated,
        pool.uniqueId
      );
    }

    const auditResult = Audit.auditBlock(block.height, transactions, projectedBlocks, auditMempool);

    const stripped = projectedBlocks[0]?.transactions ? projectedBlocks[0].transactions : [];

    let totalFees = 0;
    let totalWeight = 0;
    for (const tx of stripped) {
      totalFees += tx.fee;
      totalWeight += (tx.vsize * 4);
    }

    return {
      ...auditResult,
      expectedFees: totalFees,
      expectedWeight: totalWeight,
      projectedBlocks,
    };
  }
}

function saveCpfpDataToTransactions(transactions: MempoolTransactionExtended[], cpfpData: BlockCpfpData): void {
  for (const tx of transactions) {
    if (cpfpData.txs[tx.txid]) {
      Object.assign(tx, cpfpData.txs[tx.txid]);
    }
  }
}

export function saveCpfpDataToCpfpSummary(transactions: MempoolTransactionExtended[], cpfpData: BlockCpfpData): CpfpSummary {
  saveCpfpDataToTransactions(transactions, cpfpData);
  return {
    transactions,
    clusters: cpfpData.clusters,
    version: cpfpData.version,
  };
}

/**
 *
 * @param height
 * @param blockTransactions
 * @param poolAccelerations
 * @param fast
 *
 * saves effective fee rates from detected algorithm to blockTransactions
 */
export function detectTemplateAlgorithm(
  height: number,
  blockTransactions: MempoolTransactionExtended[],
  poolAccelerations: { txid: string; max_bid: number }[],
  fast: boolean = false
): { templateAlgorithm: TemplateAlgorithm; cpfpSummary: CpfpSummary } {

  const network = config.MEMPOOL.NETWORK || 'mainnet';
  const activationHeight = CM_ACTIVATION_HEIGHT[network] ?? Infinity;

  const legacyCpfpData = fast ? calculateFastBlockCpfp(
    height,
    blockTransactions,
  ) : calculateGoodBlockCpfp(
    height,
    blockTransactions,
    poolAccelerations
  );

  if (height < activationHeight) {
    return {
      templateAlgorithm: TemplateAlgorithm.legacy,
      cpfpSummary: saveCpfpDataToCpfpSummary(blockTransactions, legacyCpfpData),
    };
  }

  const clusterCpfpData = calculateClusterMempoolBlockCpfp(
    height,
    blockTransactions,
    poolAccelerations
  );

  const clusterTxs = blockTransactions.map(tx => ({ txid: tx.txid, rate: clusterCpfpData.txs[tx.txid].effectiveFeePerVsize ?? tx.effectiveFeePerVsize }));
  const legacyTxs = blockTransactions.map(tx => ({ txid: tx.txid, rate: legacyCpfpData.txs[tx.txid].effectiveFeePerVsize ?? tx.effectiveFeePerVsize }));
  const clusterPrioritization = transactionUtils.identifyPrioritizedTransactions(clusterTxs, 'rate');
  const legacyPrioritization = transactionUtils.identifyPrioritizedTransactions(legacyTxs, 'rate');

  const clusterCount = clusterPrioritization.prioritized.length + clusterPrioritization.deprioritized.length;
  const legacyCount = legacyPrioritization.prioritized.length + legacyPrioritization.deprioritized.length;

  if (clusterCount < legacyCount) {
    saveCpfpDataToTransactions(blockTransactions, clusterCpfpData);
    return {
      templateAlgorithm: TemplateAlgorithm.clusterMempool,
      cpfpSummary: saveCpfpDataToCpfpSummary(blockTransactions, clusterCpfpData),
    };
  } else {
    return {
      templateAlgorithm: TemplateAlgorithm.legacy,
      cpfpSummary: saveCpfpDataToCpfpSummary(blockTransactions, legacyCpfpData),
    };
  }
}

export default new BlockProcessor();
