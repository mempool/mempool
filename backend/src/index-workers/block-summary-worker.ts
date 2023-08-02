import { parentPort } from 'worker_threads';
import bitcoinApi from '../api/bitcoin/bitcoin-api-factory';
import blocks from '../api/blocks';
import config from '../config';
import transactionUtils from '../api/transaction-utils';
import bitcoinClient from '../api/bitcoin/bitcoin-client';

if (parentPort) {
  parentPort.on('message', async ({ hash, height }) => {
    if (hash != null && height != null) {
      await indexBlockSummary(hash, height);
    }

    if (parentPort) {
      parentPort.postMessage(height);
    }
  });
}

async function indexBlockSummary(hash: string, height: number): Promise<void> {
  let txs;
  if (config.MEMPOOL.BACKEND === 'esplora') {
    txs = (await bitcoinApi.$getTxsForBlock(hash)).map(tx => transactionUtils.extendTransaction(tx));
  } else {
    const block = await bitcoinClient.getBlock(hash, 2);
    txs = block.tx.map(tx => {
      tx.fee = Math.round(tx.fee * 100_000_000);
      tx.vout.forEach((vout) => {
        vout.value = Math.round(vout.value * 100000000);
      });
      tx.vsize = Math.round(tx.weight / 4); // required for backwards compatibility
      return tx;
    });
  }

  const cpfpSummary = await blocks.$indexCPFP(hash, height, txs);
  await blocks.$getStrippedBlockTransactions(hash, true, true, cpfpSummary, height); // This will index the block summary
}