import { Request, Response } from 'express';
import statistics from './api/statistics';
import feeApi from './api/fee-api';
import backendInfo from './api/backend-info';
import mempoolBlocks from './api/mempool-blocks';
import mempool from './api/mempool';
import bisq from './api/bisq';

class Routes {
  private cache = {};

  constructor() {
    this.createCache();
    setInterval(this.createCache.bind(this), 600000);
  }

  private async createCache() {
    this.cache['24h'] = await statistics.$list24H();
    this.cache['1w'] = await statistics.$list1W();
    this.cache['1m'] = await statistics.$list1M();
    this.cache['3m'] = await statistics.$list3M();
    this.cache['6m'] = await statistics.$list6M();
    this.cache['1y'] = await statistics.$list1Y();
    console.log('Statistics cache created');
  }

  public async get2HStatistics(req: Request, res: Response) {
    const result = await statistics.$list2H();
    res.send(result);
  }

  public get24HStatistics(req: Request, res: Response) {
    res.send(this.cache['24h']);
  }

  public get1WHStatistics(req: Request, res: Response) {
    res.send(this.cache['1w']);
  }

  public get1MStatistics(req: Request, res: Response) {
    res.send(this.cache['1m']);
  }

  public get3MStatistics(req: Request, res: Response) {
    res.send(this.cache['3m']);
  }

  public get6MStatistics(req: Request, res: Response) {
    res.send(this.cache['6m']);
  }

  public get1YStatistics(req: Request, res: Response) {
    res.send(this.cache['1y']);
  }

  public async getRecommendedFees(req: Request, res: Response) {
    const result = feeApi.getRecommendedFee();
    res.send(result);
  }

  public getMempoolBlocks(req: Request, res: Response) {
    try {
      const result = mempoolBlocks.getMempoolBlocks();
      res.send(result);
    } catch (e) {
      res.status(500).send(e.message);
    }
  }

  public getTransactionTimes(req: Request, res: Response) {
    if (!Array.isArray(req.query.txId)) {
      res.status(500).send('Not an array');
      return;
    }
    const txIds: string[] = [];
    for (const _txId in req.query.txId) {
      if (typeof req.query.txId[_txId] === 'string') {
        txIds.push(req.query.txId[_txId].toString());
      }
    }

    const times = mempool.getFirstSeenForTransactions(txIds);
    res.send(times);
  }

  public getBackendInfo(req: Request, res: Response) {
    res.send(backendInfo.getBackendInfo());
  }

  public getBisqTransaction(req: Request, res: Response) {
    const result = bisq.getTransaction(req.params.txId);
    if (result) {
      res.send(result);
    } else {
      res.status(404).send('Bisq transaction not found');
    }
  }

  public getBisqTransactions(req: Request, res: Response) {
    const index = parseInt(req.params.index, 10) || 0;
    const length = parseInt(req.params.length, 10) > 100 ? 100 : parseInt(req.params.length, 10) || 25;
    const [transactions, count] = bisq.getTransactions(index, length);
    res.header('X-Total-Count', count.toString());
    res.send(transactions);
  }

  public getBisqBlock(req: Request, res: Response) {
    const result = bisq.getBlock(req['hash']);
    if (result) {
      res.send(result);
    } else {
      res.status(404).send('Bisq block not found');
    }
  }

  public getBisqBlockTransactions(req: Request, res: Response) {
    const blockHash = req.params.hash || '';
    const index = parseInt(req.params.index, 10) || 0;
    const length = parseInt(req.params.length, 10) > 100 ? 100 : parseInt(req.params.length, 10) || 25;
    const [transactions, count] = bisq.getBlockTransactions(blockHash, index, length);
    if (count === -1) {
      res.header('X-Total-Count', '0');
      res.send([]);
      return;
    }
    res.header('X-Total-Count', count.toString());
    res.send(transactions);
  }
}

export default new Routes();
