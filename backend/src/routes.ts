import config from './config';
import { Request, Response } from 'express';
import statistics from './api/statistics';
import feeApi from './api/fee-api';
import backendInfo from './api/backend-info';
import mempoolBlocks from './api/mempool-blocks';
import mempool from './api/mempool';
import bisq from './api/bisq/bisq';
import websocketHandler from './api/websocket-handler';
import bisqMarket from './api/bisq/markets-api';
import { RequiredSpec, TransactionExtended } from './mempool.interfaces';
import { MarketsApiError } from './api/bisq/interfaces';
import { IEsploraApi } from './api/bitcoin/esplora-api.interface';
import logger from './logger';
import bitcoinApi from './api/bitcoin/bitcoin-api-factory';
import transactionUtils from './api/transaction-utils';
import blocks from './api/blocks';
import loadingIndicators from './api/loading-indicators';
import { Common } from './api/common';

class Routes {
  constructor() {}

  public async get2HStatistics(req: Request, res: Response) {
    const result = await statistics.$list2H();
    res.json(result);
  }

  public get24HStatistics(req: Request, res: Response) {
    res.json(statistics.getCache()['24h']);
  }

  public get1WHStatistics(req: Request, res: Response) {
    res.json(statistics.getCache()['1w']);
  }

  public get1MStatistics(req: Request, res: Response) {
    res.json(statistics.getCache()['1m']);
  }

  public get3MStatistics(req: Request, res: Response) {
    res.json(statistics.getCache()['3m']);
  }

  public get6MStatistics(req: Request, res: Response) {
    res.json(statistics.getCache()['6m']);
  }

  public get1YStatistics(req: Request, res: Response) {
    res.json(statistics.getCache()['1y']);
  }

  public getInitData(req: Request, res: Response) {
    try {
      const result = websocketHandler.getInitData();
      res.json(result);
    } catch (e) {
      res.status(500).send(e.message);
    }
  }

  public async getRecommendedFees(req: Request, res: Response) {
    if (!mempool.isInSync()) {
      res.statusCode = 503;
      res.send('Service Unavailable');
      return;
    }
    const result = feeApi.getRecommendedFee();
    res.json(result);
  }

  public getMempoolBlocks(req: Request, res: Response) {
    try {
      const result = mempoolBlocks.getMempoolBlocks();
      res.json(result);
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
    res.json(times);
  }

  public getCpfpInfo(req: Request, res: Response) {
    if (!/^[a-fA-F0-9]{64}$/.test(req.params.txId)) {
      res.status(501).send(`Invalid transaction ID.`);
      return;
    }

    const tx = mempool.getMempool()[req.params.txId];
    if (!tx) {
      res.status(404).send(`Transaction doesn't exist in the mempool.`);
      return;
    }

    if (tx.cpfpChecked) {
      res.json({
        ancestors: tx.ancestors,
        bestDescendant: tx.bestDescendant || null,
      });
      return;
    }

    const cpfpInfo = Common.setRelativesAndGetCpfpInfo(tx, mempool.getMempool());

    res.json(cpfpInfo);
  }

  public getBackendInfo(req: Request, res: Response) {
    res.json(backendInfo.getBackendInfo());
  }

  public getBisqStats(req: Request, res: Response) {
    const result = bisq.getStats();
    res.json(result);
  }

  public getBisqTip(req: Request, res: Response) {
    const result = bisq.getLatestBlockHeight();
    res.type('text/plain');
    res.send(result.toString());
  }

  public getBisqTransaction(req: Request, res: Response) {
    const result = bisq.getTransaction(req.params.txId);
    if (result) {
      res.json(result);
    } else {
      res.status(404).send('Bisq transaction not found');
    }
  }

  public getBisqTransactions(req: Request, res: Response) {
    const types: string[] = [];
    req.query.types = req.query.types || [];
    if (!Array.isArray(req.query.types)) {
      res.status(500).send('Types is not an array');
      return;
    }

    for (const _type in req.query.types) {
      if (typeof req.query.types[_type] === 'string') {
        types.push(req.query.types[_type].toString());
      }
    }

    const index = parseInt(req.params.index, 10) || 0;
    const length = parseInt(req.params.length, 10) > 100 ? 100 : parseInt(req.params.length, 10) || 25;
    const [transactions, count] = bisq.getTransactions(index, length, types);
    res.header('X-Total-Count', count.toString());
    res.json(transactions);
  }

  public getBisqBlock(req: Request, res: Response) {
    const result = bisq.getBlock(req.params.hash);
    if (result) {
      res.json(result);
    } else {
      res.status(404).send('Bisq block not found');
    }
  }

  public getBisqBlocks(req: Request, res: Response) {
    const index = parseInt(req.params.index, 10) || 0;
    const length = parseInt(req.params.length, 10) > 100 ? 100 : parseInt(req.params.length, 10) || 25;
    const [transactions, count] = bisq.getBlocks(index, length);
    res.header('X-Total-Count', count.toString());
    res.json(transactions);
  }

  public getBisqAddress(req: Request, res: Response) {
    const result = bisq.getAddress(req.params.address.substr(1));
    if (result) {
      res.json(result);
    } else {
      res.status(404).send('Bisq address not found');
    }
  }

  public getBisqMarketCurrencies(req: Request, res: Response) {
    const constraints: RequiredSpec = {
      'type': {
        required: false,
        types: ['crypto', 'fiat', 'all']
      },
    };

    const p = this.parseRequestParameters(req.query, constraints);
    if (p.error) {
      res.status(400).json(this.getBisqMarketErrorResponse(p.error));
      return;
    }

    const result = bisqMarket.getCurrencies(p.type);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketCurrencies error'));
    }
  }

  public getBisqMarketDepth(req: Request, res: Response) {
    const constraints: RequiredSpec = {
      'market': {
        required: true,
        types: ['@string']
      },
    };

    const p = this.parseRequestParameters(req.query, constraints);
    if (p.error) {
      res.status(400).json(this.getBisqMarketErrorResponse(p.error));
      return;
    }

    const result = bisqMarket.getDepth(p.market);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketDepth error'));
    }
  }

  public getBisqMarketMarkets(req: Request, res: Response) {
    const result = bisqMarket.getMarkets();
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketMarkets error'));
    }
  }

  public getBisqMarketTrades(req: Request, res: Response) {
    const constraints: RequiredSpec = {
      'market': {
        required: true,
        types: ['@string']
      },
      'timestamp_from': {
        required: false,
        types: ['@number']
      },
      'timestamp_to': {
        required: false,
        types: ['@number']
      },
      'trade_id_to': {
        required: false,
        types: ['@string']
      },
      'trade_id_from': {
        required: false,
        types: ['@string']
      },
      'direction': {
        required: false,
        types: ['buy', 'sell']
      },
      'limit': {
        required: false,
        types: ['@number']
      },
      'sort': {
        required: false,
        types: ['asc', 'desc']
      }
    };

    const p = this.parseRequestParameters(req.query, constraints);
    if (p.error) {
      res.status(400).json(this.getBisqMarketErrorResponse(p.error));
      return;
    }

    const result = bisqMarket.getTrades(p.market, p.timestamp_from,
      p.timestamp_to, p.trade_id_from, p.trade_id_to, p.direction, p.limit, p.sort);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketTrades error'));
    }
  }

  public getBisqMarketOffers(req: Request, res: Response) {
    const constraints: RequiredSpec = {
      'market': {
        required: true,
        types: ['@string']
      },
      'direction': {
        required: false,
        types: ['buy', 'sell']
      },
    };

    const p = this.parseRequestParameters(req.query, constraints);
    if (p.error) {
      res.status(400).json(this.getBisqMarketErrorResponse(p.error));
      return;
    }

    const result = bisqMarket.getOffers(p.market, p.direction);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketOffers error'));
    }
  }

  public getBisqMarketVolumes(req: Request, res: Response) {
    const constraints: RequiredSpec = {
      'market': {
        required: false,
        types: ['@string']
      },
      'interval': {
        required: false,
        types: ['minute', 'half_hour', 'hour', 'half_day', 'day', 'week', 'month', 'year', 'auto']
      },
      'timestamp_from': {
        required: false,
        types: ['@number']
      },
      'timestamp_to': {
        required: false,
        types: ['@number']
      },
      'milliseconds': {
        required: false,
        types: ['@boolean']
      },
      'timestamp': {
        required: false,
        types: ['no', 'yes']
      },
    };

    const p = this.parseRequestParameters(req.query, constraints);
    if (p.error) {
      res.status(400).json(this.getBisqMarketErrorResponse(p.error));
      return;
    }

    const result = bisqMarket.getVolumes(p.market, p.timestamp_from, p.timestamp_to, p.interval, p.milliseconds, p.timestamp);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketVolumes error'));
    }
  }

  public getBisqMarketHloc(req: Request, res: Response) {
    const constraints: RequiredSpec = {
      'market': {
        required: true,
        types: ['@string']
      },
      'interval': {
        required: false,
        types: ['minute', 'half_hour', 'hour', 'half_day', 'day', 'week', 'month', 'year', 'auto']
      },
      'timestamp_from': {
        required: false,
        types: ['@number']
      },
      'timestamp_to': {
        required: false,
        types: ['@number']
      },
      'milliseconds': {
        required: false,
        types: ['@boolean']
      },
      'timestamp': {
        required: false,
        types: ['no', 'yes']
      },
    };

    const p = this.parseRequestParameters(req.query, constraints);
    if (p.error) {
      res.status(400).json(this.getBisqMarketErrorResponse(p.error));
      return;
    }

    const result = bisqMarket.getHloc(p.market, p.interval, p.timestamp_from, p.timestamp_to, p.milliseconds, p.timestamp);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketHloc error'));
    }
  }

  public getBisqMarketTicker(req: Request, res: Response) {
    const constraints: RequiredSpec = {
      'market': {
        required: false,
        types: ['@string']
      },
    };

    const p = this.parseRequestParameters(req.query, constraints);
    if (p.error) {
      res.status(400).json(this.getBisqMarketErrorResponse(p.error));
      return;
    }

    const result = bisqMarket.getTicker(p.market);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketTicker error'));
    }
  }

  public getBisqMarketVolumes7d(req: Request, res: Response) {
    const result = bisqMarket.getVolumesByTime(604800);
    if (result) {
      res.json(result);
    } else {
      res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketVolumes7d error'));
    }
  }

  private parseRequestParameters(requestParams: object, params: RequiredSpec): { [name: string]: any; } {
    const final = {};
    for (const i in params) {
      if (params.hasOwnProperty(i)) {
        if (params[i].required && requestParams[i] === undefined) {
          return { error: i + ' parameter missing'};
        }
        if (typeof requestParams[i] === 'string') {
          const str = (requestParams[i] || '').toString().toLowerCase();
          if (params[i].types.indexOf('@number') > -1) {
            const number = parseInt((str).toString(), 10);
            final[i] = number;
          } else if (params[i].types.indexOf('@string') > -1) {
            final[i] = str;
          } else if (params[i].types.indexOf('@boolean') > -1) {
            final[i] = str === 'true' || str === 'yes';
          } else if (params[i].types.indexOf(str) > -1) {
            final[i] = str;
          } else {
            return { error: i + ' parameter invalid'};
          }
        } else if (typeof requestParams[i] === 'number') {
          final[i] = requestParams[i];
        }
      }
    }
    return final;
  }

  private getBisqMarketErrorResponse(message: string): MarketsApiError {
    return {
      'success': 0,
      'error': message
    };
  }

  public async getTransaction(req: Request, res: Response) {
    try {
      const transaction = await transactionUtils.$getTransactionExtended(req.params.txId, true);
      res.json(transaction);
    } catch (e) {
      let statusCode = 500;
      if (e.message && e.message.indexOf('No such mempool or blockchain transaction') > -1) {
        statusCode = 404;
      }
      res.status(statusCode).send(e.message || e);
    }
  }

  public async getTransactionStatus(req: Request, res: Response) {
    try {
      const transaction = await transactionUtils.$getTransactionExtended(req.params.txId, true);
      res.json(transaction.status);
    } catch (e) {
      let statusCode = 500;
      if (e.message && e.message.indexOf('No such mempool or blockchain transaction') > -1) {
        statusCode = 404;
      }
      res.status(statusCode).send(e.message || e);
    }
  }

  public async getBlock(req: Request, res: Response) {
    try {
      const result = await bitcoinApi.$getBlock(req.params.hash);
      res.json(result);
    } catch (e) {
      res.status(500).send(e.message || e);
    }
  }

  public async getBlockHeader(req: Request, res: Response) {
    try {
      const blockHeader = await bitcoinApi.$getBlockHeader(req.params.hash);
      res.send(blockHeader);
    } catch (e) {
      res.status(500).send(e.message || e);
    }
  }

  public async getBlocks(req: Request, res: Response) {
    try {
      loadingIndicators.setProgress('blocks', 0);

      const returnBlocks: IEsploraApi.Block[] = [];
      const fromHeight = parseInt(req.params.height, 10) || blocks.getCurrentBlockHeight();

      // Check if block height exist in local cache to skip the hash lookup
      const blockByHeight = blocks.getBlocks().find((b) => b.height === fromHeight);
      let startFromHash: string | null = null;
      if (blockByHeight) {
        startFromHash = blockByHeight.id;
      } else {
        startFromHash = await bitcoinApi.$getBlockHash(fromHeight);
      }

      let nextHash = startFromHash;
      for (let i = 0; i < 10; i++) {
        const localBlock = blocks.getBlocks().find((b) => b.id === nextHash);
        if (localBlock) {
          returnBlocks.push(localBlock);
          nextHash = localBlock.previousblockhash;
        } else {
          const block = await bitcoinApi.$getBlock(nextHash);
          returnBlocks.push(block);
          nextHash = block.previousblockhash;
        }
        loadingIndicators.setProgress('blocks', i / 10 * 100);
      }

      res.json(returnBlocks);
    } catch (e) {
      loadingIndicators.setProgress('blocks', 100);
      res.status(500).send(e.message || e);
    }
  }

  public async getBlockTransactions(req: Request, res: Response) {
    try {
      loadingIndicators.setProgress('blocktxs-' + req.params.hash, 0);

      const txIds = await bitcoinApi.$getTxIdsForBlock(req.params.hash);
      const transactions: TransactionExtended[] = [];
      const startingIndex = Math.max(0, parseInt(req.params.index || '0', 10));

      const endIndex = Math.min(startingIndex + 10, txIds.length);
      for (let i = startingIndex; i < endIndex; i++) {
        try {
          const transaction = await transactionUtils.$getTransactionExtended(txIds[i], true);
          transactions.push(transaction);
          loadingIndicators.setProgress('blocktxs-' + req.params.hash, (i + 1) / endIndex * 100);
        } catch (e) {
          logger.debug('getBlockTransactions error: ' + e.message || e);
        }
      }
      res.json(transactions);
    } catch (e) {
      loadingIndicators.setProgress('blocktxs-' + req.params.hash, 100);
      res.status(500).send(e.message || e);
    }
  }

  public async getBlockHeight(req: Request, res: Response) {
    try {
      const blockHash = await bitcoinApi.$getBlockHash(parseInt(req.params.height, 10));
      res.send(blockHash);
    } catch (e) {
      res.status(500).send(e.message || e);
    }
  }

  public async getAddress(req: Request, res: Response) {
    if (config.MEMPOOL.BACKEND === 'none') {
      res.status(405).send('Address lookups cannot be used with bitcoind as backend.');
      return;
    }

    try {
      const addressData = await bitcoinApi.$getAddress(req.params.address);
      res.json(addressData);
    } catch (e) {
      if (e.message && e.message.indexOf('exceeds') > 0) {
        return res.status(413).send(e.message);
      }
      res.status(500).send(e.message || e);
    }
  }

  public async getAddressTransactions(req: Request, res: Response) {
    if (config.MEMPOOL.BACKEND === 'none') {
      res.status(405).send('Address lookups cannot be used with bitcoind as backend.');
      return;
    }

    try {
      const transactions = await bitcoinApi.$getAddressTransactions(req.params.address, req.params.txId);
      res.json(transactions);
    } catch (e) {
      if (e.message && e.message.indexOf('exceeds') > 0) {
        return res.status(413).send(e.message);
      }
      res.status(500).send(e.message || e);
    }
  }

  public async getAdressTxChain(req: Request, res: Response) {
    res.status(501).send('Not implemented');
  }

  public async getAddressPrefix(req: Request, res: Response) {
    try {
      const blockHash = await bitcoinApi.$getAddressPrefix(req.params.prefix);
      res.send(blockHash);
    } catch (e) {
      res.status(500).send(e.message || e);
    }
  }

  public async getRecentMempoolTransactions(req: Request, res: Response) {
    const latestTransactions = Object.entries(mempool.getMempool())
      .sort((a, b) => (b[1].firstSeen || 0) - (a[1].firstSeen || 0))
      .slice(0, 10).map((tx) => Common.stripTransaction(tx[1]));

    res.json(latestTransactions);
  }

  public async getMempool(req: Request, res: Response) {
    res.status(501).send('Not implemented');
  }

  public async getMempoolTxIds(req: Request, res: Response) {
    try {
      const rawMempool = await bitcoinApi.$getRawMempool();
      res.send(rawMempool);
    } catch (e) {
      res.status(500).send(e.message || e);
    }
  }

  public async getBlockTipHeight(req: Request, res: Response) {
    try {
      const result = await bitcoinApi.$getBlockHeightTip();
      res.json(result);
    } catch (e) {
      res.status(500).send(e.message || e);
    }
  }

  public async getTxIdsForBlock(req: Request, res: Response) {
    try {
      const result = await bitcoinApi.$getTxIdsForBlock(req.params.hash);
      res.json(result);
    } catch (e) {
      res.status(500).send(e.message || e);
    }
  }

  public getTransactionOutspends(req: Request, res: Response) {
    res.status(501).send('Not implemented');
  }
}

export default new Routes();
