const config = require('../../mempool-config.json');
import bitcoinApi from './bitcoin-api-wrapper';
import { ITransaction, IMempoolInfo, IMempool } from '../interfaces';

class Mempool {
  private mempool: IMempool = {};
  private mempoolInfo: IMempoolInfo | undefined;
  private mempoolChangedCallback: Function | undefined;

  private txPerSecondArray: number[] = [];
  private txPerSecond: number = 0;

  private vBytesPerSecondArray: any[] = [];
  private vBytesPerSecond: number = 0;

  constructor() {
    setInterval(this.updateTxPerSecond.bind(this), 1000);
  }

  public setMempoolChangedCallback(fn: Function) {
    this.mempoolChangedCallback = fn;
  }

  public getMempool(): { [txid: string]: ITransaction } {
    return this.mempool;
  }

  public setMempool(mempoolData: any) {
    this.mempool = mempoolData;
  }

  public getMempoolInfo(): IMempoolInfo | undefined {
    return this.mempoolInfo;
  }

  public getTxPerSecond(): number {
    return this.txPerSecond;
  }

  public getVBytesPerSecond(): number {
    return this.vBytesPerSecond;
  }

  public async updateMemPoolInfo() {
    try {
      this.mempoolInfo = await bitcoinApi.getMempoolInfo();
    } catch (err) {
      console.log('Error getMempoolInfo', err);
    }
  }

  public async getRawTransaction(txId: string, isCoinbase = false): Promise<ITransaction | false> {
    try {
      const transaction = await bitcoinApi.getRawTransaction(txId);
      let totalIn = 0;
      if (!isCoinbase) {
        for (let i = 0; i < transaction.vin.length; i++) {
          try {
            const result = await bitcoinApi.getRawTransaction(transaction.vin[i].txid);
            transaction.vin[i]['value'] = result.vout[transaction.vin[i].vout].value;
            totalIn += result.vout[transaction.vin[i].vout].value;
          } catch (err) {
            console.log('Locating historical tx error');
          }
        }
      }
      let totalOut = 0;
      transaction.vout.forEach((output) => totalOut += output.value);

      if (totalIn > totalOut) {
        transaction.fee = parseFloat((totalIn - totalOut).toFixed(8));
        transaction.feePerWeightUnit = (transaction.fee * 100000000) / (transaction.vsize * 4) || 0;
        transaction.feePerVsize = (transaction.fee * 100000000) / (transaction.vsize) || 0;
      } else if (!isCoinbase) {
        transaction.fee = 0;
        transaction.feePerVsize = 0;
        transaction.feePerWeightUnit = 0;
        console.log('Minus fee error!');
      }
      transaction.totalOut = totalOut;
      return transaction;
    } catch (e) {
      console.log(txId + ' not found');
      return false;
    }
  }

  public async updateMempool() {
    console.log('Updating mempool');
    const start = new Date().getTime();
    let hasChange: boolean = false;
    let txCount = 0;
    try {
      const transactions = await bitcoinApi.getRawMempool();
      const diff = transactions.length - Object.keys(this.mempool).length;
      for (const tx of transactions) {
        if (!this.mempool[tx]) {
          const transaction = await this.getRawTransaction(tx);
          if (transaction) {
            this.mempool[tx] = transaction;
            txCount++;
            this.txPerSecondArray.push(new Date().getTime());
            this.vBytesPerSecondArray.push({
              unixTime: new Date().getTime(),
              vSize: transaction.vsize,
            });
            hasChange = true;
            if (diff > 0) {
              console.log('Calculated fee for transaction ' + txCount + ' / ' + diff);
            } else {
              console.log('Calculated fee for transaction ' + txCount);
            }
          } else {
            console.log('Error finding transaction in mempool.');
          }
        }
      }

      const newMempool: IMempool = {};
      transactions.forEach((tx) => {
        if (this.mempool[tx]) {
          newMempool[tx] = this.mempool[tx];
        } else {
          hasChange = true;
        }
      });

      this.mempool = newMempool;

      if (hasChange && this.mempoolChangedCallback) {
        this.mempoolChangedCallback(this.mempool);
      }

      const end = new Date().getTime();
      const time = end - start;
      console.log('Mempool updated in ' + time / 1000 + ' seconds');
    } catch (err) {
      console.log('getRawMempool error.', err);
    }
  }

  private updateTxPerSecond() {
    const nowMinusTimeSpan = new Date().getTime() - (1000 * config.TX_PER_SECOND_SPAN_SECONDS);
    this.txPerSecondArray = this.txPerSecondArray.filter((unixTime) => unixTime > nowMinusTimeSpan);
    this.txPerSecond = this.txPerSecondArray.length / config.TX_PER_SECOND_SPAN_SECONDS || 0;

    this.vBytesPerSecondArray = this.vBytesPerSecondArray.filter((data) => data.unixTime > nowMinusTimeSpan);
    if (this.vBytesPerSecondArray.length) {
      this.vBytesPerSecond = Math.round(
        this.vBytesPerSecondArray.map((data) => data.vSize).reduce((a, b) => a + b) / config.TX_PER_SECOND_SPAN_SECONDS
      );
    }
  }
}

export default new Mempool();
