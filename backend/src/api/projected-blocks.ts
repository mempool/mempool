const config = require('../../mempool-config.json');
import { ITransaction, IProjectedBlock, IMempool, IProjectedBlockInternal } from '../interfaces';

class ProjectedBlocks {
  private transactionsSorted: ITransaction[] = [];

  constructor() {}

  public getProjectedBlockFeesForBlock(index: number) {
    const projectedBlock = this.getProjectedBlocksInternal()[index];

    if (!projectedBlock) {
      throw new Error('No projected block for that index');
    }

    return projectedBlock.txFeePerVsizes.map((fpv) => {
      return {'fpv': fpv};
    });
  }

  public updateProjectedBlocks(memPool: IMempool): void {
    const latestMempool = memPool;
    const memPoolArray: ITransaction[] = [];
    for (const i in latestMempool) {
      if (latestMempool.hasOwnProperty(i)) {
        memPoolArray.push(latestMempool[i]);
      }
    }
    memPoolArray.sort((a, b) => b.feePerWeightUnit - a.feePerWeightUnit);
    this.transactionsSorted = memPoolArray.filter((tx) => tx.feePerWeightUnit);
  }

  public getProjectedBlocks(txId?: string, numberOfBlocks: number = config.DEFAULT_PROJECTED_BLOCKS_AMOUNT): IProjectedBlock[] {
    return this.getProjectedBlocksInternal(numberOfBlocks).map((projectedBlock) => {
      return {
        blockSize: projectedBlock.blockSize,
        blockWeight: projectedBlock.blockWeight,
        nTx: projectedBlock.nTx,
        minFee: projectedBlock.minFee,
        maxFee: projectedBlock.maxFee,
        minWeightFee: projectedBlock.minWeightFee,
        maxWeightFee: projectedBlock.maxWeightFee,
        medianFee: projectedBlock.medianFee,
        fees: projectedBlock.fees,
        hasMytx: txId ? projectedBlock.txIds.some((tx) => tx === txId) : false
      };
    });
  }

  private getProjectedBlocksInternal(numberOfBlocks: number = config.DEFAULT_PROJECTED_BLOCKS_AMOUNT): IProjectedBlockInternal[] {
    const projectedBlocks: IProjectedBlockInternal[] = [];
    let blockWeight = 0;
    let blockSize = 0;
    let transactions: ITransaction[] = [];
    this.transactionsSorted.forEach((tx) => {
      if (blockWeight + tx.vsize * 4 < 4000000 || projectedBlocks.length === numberOfBlocks) {
        blockWeight += tx.vsize * 4;
        blockSize += tx.size;
        transactions.push(tx);
      } else {
        projectedBlocks.push(this.dataToProjectedBlock(transactions, blockSize, blockWeight));
        blockWeight = 0;
        blockSize = 0;
        transactions = [];
      }
    });
    if (transactions.length) {
      projectedBlocks.push(this.dataToProjectedBlock(transactions, blockSize, blockWeight));
    }
    return projectedBlocks;
  }

  private dataToProjectedBlock(transactions: ITransaction[], blockSize: number, blockWeight: number): IProjectedBlockInternal {
    return {
      blockSize: blockSize,
      blockWeight: blockWeight,
      nTx: transactions.length - 1,
      minFee: transactions[transactions.length - 1].feePerVsize,
      maxFee: transactions[0].feePerVsize,
      minWeightFee: transactions[transactions.length - 1].feePerWeightUnit,
      maxWeightFee: transactions[0].feePerWeightUnit,
      medianFee: this.median(transactions.map((tx) => tx.feePerVsize)),
      txIds: transactions.map((tx) => tx.txid),
      txFeePerVsizes: transactions.map((tx) => tx.feePerVsize).reverse(),
      fees: transactions.map((tx) => tx.fee).reduce((acc, currValue) => acc + currValue),
    };
  }

  private median(numbers: number[]) {
    let medianNr = 0;
    const numsLen = numbers.length;
    numbers.sort();
    if (numsLen % 2 === 0) {
        medianNr = (numbers[numsLen / 2 - 1] + numbers[numsLen / 2]) / 2;
    } else {
        medianNr = numbers[(numsLen - 1) / 2];
    }
    return medianNr;
  }
}

export default new ProjectedBlocks();
