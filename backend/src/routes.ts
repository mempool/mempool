import statistics from './api/statistics';
import feeApi from './api/fee-api';
import projectedBlocks from './api/projected-blocks';

class Routes {
  constructor() {}

  public async get2HStatistics(req, res) {
    const result = await statistics.$list2H();
    res.send(result);
  }

  public async get24HStatistics(req, res) {
    const result = await statistics.$list24H();
    res.send(result);
  }

  public async get1WHStatistics(req, res) {
    const result = await statistics.$list1W();
    res.send(result);
  }

  public async get1MStatistics(req, res) {
    const result = await statistics.$list1M();
    res.send(result);
  }

  public async get3MStatistics(req, res) {
    const result = await statistics.$list3M();
    res.send(result);
  }

  public async get6MStatistics(req, res) {
    const result = await statistics.$list6M();
    res.send(result);
  }

  public async getRecommendedFees(req, res) {
    const result = feeApi.getRecommendedFee();
    res.send(result);
  }

  public async $getgetTransactionsForBlock(req, res) {
    const result = await feeApi.$getTransactionsForBlock(req.params.id);
    res.send(result);
  }

  public async getgetTransactionsForProjectedBlock(req, res) {
    try {
      const result = await projectedBlocks.getProjectedBlockFeesForBlock(req.params.id);
      res.send(result);
    } catch (e) {
      res.status(500).send(e.message);
    }
  }

  public async getProjectedBlocks(req, res) {
    try {
      let txId: string | undefined;
      if (req.query.txId && /^[a-fA-F0-9]{64}$/.test(req.query.txId)) {
        txId = req.query.txId;
      }
      const result = await projectedBlocks.getProjectedBlocks(txId, 6);
      res.send(result);
    } catch (e) {
      res.status(500).send(e.message);
    }
  }
}

export default new Routes();
