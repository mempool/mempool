import { parentPort } from 'worker_threads';
import bitcoinApi from '../api/bitcoin/bitcoin-api-factory';
import blocksRepository from '../repositories/BlocksRepository';
import blocks from '../api/blocks';
import { IEsploraApi } from '../api/bitcoin/esplora-api.interface';

if (parentPort) {
  parentPort.on('message', async (params) => {
    if (params.height != null) {
      await indexBlock(params.height);
    }

    if (parentPort) {
      parentPort.postMessage(params.height);
    }
  });
}

async function indexBlock(blockHeight: number): Promise<void> {
  const blockHash = await bitcoinApi.$getBlockHash(blockHeight);
  const block: IEsploraApi.Block = await bitcoinApi.$getBlock(blockHash);
  const transactions = await blocks['$getTransactionsExtended'](blockHash, block.height, true, null, true);
  const blockExtended = await blocks['$getBlockExtended'](block, transactions);
  await blocksRepository.$saveBlockInDatabase(blockExtended);
}