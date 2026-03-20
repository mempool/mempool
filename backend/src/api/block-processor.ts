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
import { calculateGoodBlockCpfp, calculateClusterMempoolBlockCpfp, calculateFastBlockCpfp } from './cpfp';
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

    logger.debug(`Block #${block.height} detected template algorithm: ${templateAlgorithm === TemplateAlgorithm.clusterMempool ? 'cluster mempool' : 'legacy GBT'}`);

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
      const clusterMempool = memPool.clusterMempool ?? new ClusterMempool(auditMempool, accelerations);
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

    const auditResult = Audit.auditBlock(block.height, structuredClone(transactions), projectedBlocks, auditMempool);

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

export function detectTemplateAlgorithm(
  height: number,
  blockTransactions: MempoolTransactionExtended[],
  poolAccelerations: { txid: string; max_bid: number }[],
  fast: boolean = false
): { templateAlgorithm: TemplateAlgorithm; cpfpSummary: CpfpSummary } {

  const network = config.MEMPOOL.NETWORK || 'mainnet';
  const activationHeight = CM_ACTIVATION_HEIGHT[network] ?? Infinity;

  // always need the legacy CPFP summary
  const legacyCpfpSummary = fast ? calculateFastBlockCpfp(
    height,
    structuredClone(blockTransactions),
  ) : calculateGoodBlockCpfp(
    height,
    structuredClone(blockTransactions),
    poolAccelerations
  );

  // assume legacy below the activation height
  if (height < activationHeight) {
    return {
      templateAlgorithm: TemplateAlgorithm.legacy,
      cpfpSummary: legacyCpfpSummary,
    };
  }

  // calculate single-block CPFP rates for each algorithm
  const clusterCpfpSummary = calculateClusterMempoolBlockCpfp(
    height,
    structuredClone(blockTransactions),
    poolAccelerations
  );
  const clusterRates = new Map<string, number>();
  const legacyRates = new Map<string, number>();
  for (const tx of clusterCpfpSummary.transactions) {
    clusterRates.set(tx.txid, tx.effectiveFeePerVsize);
  }
  for (const tx of legacyCpfpSummary.transactions) {
    legacyRates.set(tx.txid, tx.effectiveFeePerVsize);
  }
  const clusterTxs = blockTransactions.map(tx => ({...tx, effectiveFeePerVsize: clusterRates.get(tx.txid) || tx.effectiveFeePerVsize}));
  const legacyTxs = blockTransactions.map(tx => ({...tx, effectiveFeePerVsize: legacyRates.get(tx.txid) || tx.effectiveFeePerVsize}));

  // identify apparent prioritizations using each algorithm's rates
  const clusterPrioritization = transactionUtils.identifyPrioritizedTransactions(clusterTxs, 'effectiveFeePerVsize');
  const legacyPrioritization = transactionUtils.identifyPrioritizedTransactions(legacyTxs, 'effectiveFeePerVsize');

  // choose the best fitting algorithm (or legacy if tied)
  const clusterCount = clusterPrioritization.prioritized.length + clusterPrioritization.deprioritized.length;
  const legacyCount = legacyPrioritization.prioritized.length + legacyPrioritization.deprioritized.length;
  logger.debug(`Prioritization counts - cluster: ${clusterCount}, legacy: ${legacyCount}`);
  if (clusterCount < legacyCount) {
    return {
      templateAlgorithm: TemplateAlgorithm.clusterMempool,
      cpfpSummary: clusterCpfpSummary,
    };
  } else {
    return {
      templateAlgorithm: TemplateAlgorithm.legacy,
      cpfpSummary: legacyCpfpSummary,
    };
  }
}

export default new BlockProcessor();
