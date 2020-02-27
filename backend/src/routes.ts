import statistics from './api/statistics';
import feeApi from './api/fee-api';
import mempoolBlocks from './api/mempool-blocks';
import mempool from './api/mempool';

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

  public async get2HStatistics(req, res) {
    const result = await statistics.$list2H();
    res.send(result);
  }

  public get24HStatistics(req, res) {
    res.send(this.cache['24h']);
  }

  public get1WHStatistics(req, res) {
    res.send(this.cache['1w']);
  }

  public get1MStatistics(req, res) {
    res.send(this.cache['1m']);
  }

  public get3MStatistics(req, res) {
    res.send(this.cache['3m']);
  }

  public get6MStatistics(req, res) {
    res.send(this.cache['6m']);
  }

  public get1YStatistics(req, res) {
    res.send(this.cache['1y']);
  }

  public async getRecommendedFees(req, res) {
    const result = feeApi.getRecommendedFee();
    res.send(result);
  }

  public async getMempoolBlocks(req, res) {
    try {
      const result = await mempoolBlocks.getMempoolBlocks();
      res.send(result);
    } catch (e) {
      res.status(500).send(e.message);
    }
  }

  public getTransactionTimes(req, res) {
    if (!Array.isArray(req.query.txId)) {
      res.status(500).send('Not an array');
      return;
    }
    const txIds = req.query.txId;
    const times = mempool.getFirstSeenForTransactions(txIds);
    res.send(times);
  }
}

export default new Routes();
