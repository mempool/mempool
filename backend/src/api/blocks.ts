const config = require('../../mempool-config.json');
import bitcoinApi from './bitcoin-api-wrapper';
import { DB } from '../database';
import { IBlock, ITransaction } from '../interfaces';
import memPool from './mempool';

class Blocks {
  private blocks: IBlock[] = [];
  private newBlockCallback: Function | undefined;

  public setNewBlockCallback(fn: Function) {
    this.newBlockCallback = fn;
  }

  public getBlocks(): IBlock[] {
    return this.blocks;
  }

  public formatBlock(block: IBlock) {
    return {
      hash: block.hash,
      height: block.height,
      nTx: block.nTx - 1,
      size: block.size,
      time: block.time,
      weight: block.weight,
      fees: block.fees,
      minFee: block.minFee,
      maxFee: block.maxFee,
      medianFee: block.medianFee,
    };
  }

  public async updateBlocks() {
    try {
      const blockCount = await bitcoinApi.getBlockCount();

      let currentBlockHeight = 0;
      if (this.blocks.length === 0) {
        currentBlockHeight = blockCount - config.INITIAL_BLOCK_AMOUNT;
      } else {
        currentBlockHeight = this.blocks[this.blocks.length - 1].height;
      }

      while (currentBlockHeight < blockCount) {
        currentBlockHeight++;

        let block: IBlock | undefined;

        const storedBlock = await this.$getBlockFromDatabase(currentBlockHeight);
        if (storedBlock) {
          block = storedBlock;
        } else {
          const blockHash = await bitcoinApi.getBlockHash(currentBlockHeight);
          block = await bitcoinApi.getBlock(blockHash, 1);

          const coinbase = await memPool.getRawTransaction(block.tx[0], true);
          if (coinbase && coinbase.totalOut) {
            block.fees = coinbase.totalOut;
          }

          const mempool = memPool.getMempool();
          let found = 0;
          let notFound = 0;

          let transactions: ITransaction[] = [];

          for (let i = 1; i < block.tx.length; i++) {
            if (mempool[block.tx[i]]) {
              transactions.push(mempool[block.tx[i]]);
              found++;
            } else {
              const tx = await memPool.getRawTransaction(block.tx[i]);
              if (tx) {
                transactions.push(tx);
              }
              notFound++;
            }
          }

          transactions.sort((a, b) => b.feePerVsize - a.feePerVsize);
          transactions = transactions.filter((tx: ITransaction) => tx.feePerVsize);

          block.minFee = transactions[transactions.length - 1] ? transactions[transactions.length - 1].feePerVsize : 0;
          block.maxFee = transactions[0] ? transactions[0].feePerVsize : 0;
          block.medianFee = this.median(transactions.map((tx) => tx.feePerVsize));

          if (this.newBlockCallback) {
            this.newBlockCallback(block);
          }

          await this.$saveBlockToDatabase(block);
          await this.$saveTransactionsToDatabase(block.height, transactions);
          console.log(`New block found (#${currentBlockHeight})! ${found} of ${block.tx.length} found in mempool. ${notFound} not found.`);
        }

        this.blocks.push(block);
        if (this.blocks.length > config.KEEP_BLOCK_AMOUNT) {
          this.blocks.shift();
        }

      }
    } catch (err) {
      console.log('Error getBlockCount', err);
    }
  }

  private async $getBlockFromDatabase(height: number): Promise<IBlock | undefined> {
    try {
      const connection = await DB.pool.getConnection();
      const query = `
        SELECT * FROM blocks WHERE height = ?
      `;

      const [rows] = await connection.query<any>(query, [height]);
      connection.release();

      if (rows[0]) {
        return rows[0];
      }
    } catch (e) {
      console.log('$get() block error', e);
    }
  }

  private async $saveBlockToDatabase(block: IBlock) {
    try {
      const connection = await DB.pool.getConnection();
      const query = `
        INSERT IGNORE INTO blocks
        (height, hash, size, weight, minFee, maxFee, time, fees, nTx, medianFee)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params: (any)[] = [
        block.height,
        block.hash,
        block.size,
        block.weight,
        block.minFee,
        block.maxFee,
        block.time,
        block.fees,
        block.nTx - 1,
        block.medianFee,
      ];

      await connection.query(query, params);
      connection.release();
    } catch (e) {
      console.log('$create() block error', e);
    }
  }

  private async $saveTransactionsToDatabase(blockheight: number, transactions: ITransaction[]) {
    try {
      const connection = await DB.pool.getConnection();

      for (let i = 0; i < transactions.length; i++) {
        const query = `
          INSERT IGNORE INTO transactions
          (blockheight, txid, fee, feePerVsize)
          VALUES(?, ?, ?, ?)
        `;

        const params: (any)[] = [
          blockheight,
          transactions[i].txid,
          transactions[i].fee,
          transactions[i].feePerVsize,
        ];

        await connection.query(query, params);
      }


      connection.release();
    } catch (e) {
      console.log('$create() transaction error', e);
    }
  }

  private median(numbers: number[]) {
    if (!numbers.length) { return 0; }
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

export default new Blocks();
