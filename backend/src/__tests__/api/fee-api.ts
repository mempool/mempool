import feeApi from '../../api/fee-api';
import { IBitcoinApi } from '../../api/bitcoin/bitcoin-api.interface';
const feeMempoolBlocks = require('./test-data/fee-mempool-blocks.json');


const subSatMempoolInfo: IBitcoinApi.MempoolInfo = {
  mempoolminfee: 0.000001, // 0.1 sat/vbyte
  loaded: true,
  size: 100,
  bytes: 10000,
  usage: 10000,
  total_fee: 10000,
  maxmempool: 10000,
  minrelaytxfee: 0.000001, // 0.1 sat/vbyte
};

const mempoolInfo: IBitcoinApi.MempoolInfo = {
  mempoolminfee: 0.00001,
  loaded: true,
  size: 100,
  bytes: 10000,
  usage: 10000,
  total_fee: 10000,
  maxmempool: 10000,
  minrelaytxfee: 0.00001,
};

describe('Fee API', () => {
  test('should calculate recommended fees properly for sub-sat mempool', () => {
    const fee = feeApi.calculateRecommendedFee(feeMempoolBlocks.subsat, subSatMempoolInfo);
    expect(fee.fastestFee).toBe(2);
    expect(fee.halfHourFee).toBe(1);
    expect(fee.hourFee).toBe(1);
    expect(fee.economyFee).toBe(1);
    expect(fee.minimumFee).toBe(1);
  });

  test('should calculate recommended fees properly for full but low fee mempool', () => {
    const fee = feeApi.calculateRecommendedFee(feeMempoolBlocks.lowfee, mempoolInfo);
    expect(fee.fastestFee).toBe(2);
    expect(fee.halfHourFee).toBe(2);
    expect(fee.hourFee).toBe(2);
    expect(fee.economyFee).toBe(2);
    expect(fee.minimumFee).toBe(1);
  });

  test('should calculate recommended fees properly for empty mempool', () => {
    const fee = feeApi.calculateRecommendedFee(feeMempoolBlocks.empty, mempoolInfo);
    expect(fee.fastestFee).toBe(1);
    expect(fee.halfHourFee).toBe(1);
    expect(fee.hourFee).toBe(1);
    expect(fee.economyFee).toBe(1);
    expect(fee.minimumFee).toBe(1);
  });
});