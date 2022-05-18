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
import bitcoinClient from './api/bitcoin/bitcoin-client';
import elementsParser from './api/liquid/elements-parser';
import icons from './api/liquid/icons';
import miningStats from './api/mining';
import axios from 'axios';
import mining from './api/mining';
import BlocksRepository from './repositories/BlocksRepository';
import HashratesRepository from './repositories/HashratesRepository';
import difficultyAdjustment from './api/difficulty-adjustment';

class Routes {
  constructor() {}

  public async $getStatisticsByTime(time: '2h' | '24h' | '1w' | '1m' | '3m' | '6m' | '1y' | '2y' | '3y', req: Request, res: Response) {
    res.header('Pragma', 'public');
    res.header('Cache-control', 'public');
    res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());

    try {
      let result;
      switch (time as string) {
        case '2h':
          result = await statistics.$list2H();
          res.setHeader('Expires', new Date(Date.now() + 1000 * 30).toUTCString());
          break;
        case '24h':
          result = await statistics.$list24H();
          res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
          break;
        case '1w':
          result = await statistics.$list1W();
          break;
        case '1m':
          result = await statistics.$list1M();
          break;
        case '3m':
          result = await statistics.$list3M();
          break;
        case '6m':
          result = await statistics.$list6M();
          break;
        case '1y':
          result = await statistics.$list1Y();
          break;
        case '2y':
          result = await statistics.$list2Y();
          break;
        case '3y':
          result = await statistics.$list3Y();
          break;
        default:
          result = await statistics.$list2H();
      }
      res.json(result);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public getInitData(req: Request, res: Response) {
    try {
      const result = websocketHandler.getInitData();
      res.json(result);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public getRecommendedFees(req: Request, res: Response) {
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
      res.status(500).send(e instanceof Error ? e.message : e);
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
      if (e instanceof Error && e instanceof Error && e.message && e.message.indexOf('No such mempool or blockchain transaction') > -1) {
        statusCode = 404;
      }
      res.status(statusCode).send(e instanceof Error ? e.message : e);
    }
  }

  public async getRawTransaction(req: Request, res: Response) {
    try {
      const transaction: IEsploraApi.Transaction = await bitcoinApi.$getRawTransaction(req.params.txId, true);
      res.setHeader('content-type', 'text/plain');
      res.send(transaction.hex);
    } catch (e) {
      let statusCode = 500;
      if (e instanceof Error && e.message && e.message.indexOf('No such mempool or blockchain transaction') > -1) {
        statusCode = 404;
      }
      res.status(statusCode).send(e instanceof Error ? e.message : e);
    }
  }

  public async getTransactionStatus(req: Request, res: Response) {
    try {
      const transaction = await transactionUtils.$getTransactionExtended(req.params.txId, true);
      res.json(transaction.status);
    } catch (e) {
      let statusCode = 500;
      if (e instanceof Error && e.message && e.message.indexOf('No such mempool or blockchain transaction') > -1) {
        statusCode = 404;
      }
      res.status(statusCode).send(e instanceof Error ? e.message : e);
    }
  }

  public async $getPool(req: Request, res: Response) {
    try {
      const stats = await mining.$getPoolStat(req.params.slug);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(stats);
    } catch (e) {
      if (e instanceof Error && e.message.indexOf('This mining pool does not exist') > -1) {
        res.status(404).send(e.message);
      } else {
        res.status(500).send(e instanceof Error ? e.message : e);
      }
    }
  }

  public async $getPoolBlocks(req: Request, res: Response) {
    try {
      const poolBlocks = await BlocksRepository.$getBlocksByPool(
        req.params.slug,
        req.params.height === undefined ? undefined : parseInt(req.params.height, 10),
      );
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(poolBlocks);
    } catch (e) {
      if (e instanceof Error && e.message.indexOf('This mining pool does not exist') > -1) {
        res.status(404).send(e.message);
      } else {
        res.status(500).send(e instanceof Error ? e.message : e);
      }
    }
  }

  public async $getPools(interval: string, req: Request, res: Response) {
    try {
      const stats = await miningStats.$getPoolsStats(interval);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(stats);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async $getPoolsHistoricalHashrate(req: Request, res: Response) {
    try {
      const hashrates = await HashratesRepository.$getPoolsWeeklyHashrate(req.params.interval ?? null);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());
      res.json(hashrates);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async $getPoolHistoricalHashrate(req: Request, res: Response) {
    try {
      const hashrates = await HashratesRepository.$getPoolWeeklyHashrate(req.params.slug);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());
      res.json(hashrates);
    } catch (e) {
      if (e instanceof Error && e.message.indexOf('This mining pool does not exist') > -1) {
        res.status(404).send(e.message);
      } else {
        res.status(500).send(e instanceof Error ? e.message : e);
      }
    }
  }

  public async $getHistoricalHashrate(req: Request, res: Response) {
    try {
      const hashrates = await HashratesRepository.$getNetworkDailyHashrate(req.params.interval ?? null);
      const difficulty = await BlocksRepository.$getBlocksDifficulty(req.params.interval ?? null);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());
      res.json({
        hashrates: hashrates,
        difficulty: difficulty,
        currentHashrate: await bitcoinClient.getNetworkHashPs(),
        currentDifficulty: await bitcoinClient.getDifficulty(),
      });
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async $getHistoricalBlockFees(req: Request, res: Response) {
    try {
      const blockFees = await mining.$getHistoricalBlockFees(req.params.interval ?? null);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());
      res.json(blockFees);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async $getHistoricalBlockRewards(req: Request, res: Response) {
    try {
      const blockRewards = await mining.$getHistoricalBlockRewards(req.params.interval ?? null);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());
      res.json(blockRewards);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async $getHistoricalBlockFeeRates(req: Request, res: Response) {
    try {
      const blockFeeRates = await mining.$getHistoricalBlockFeeRates(req.params.interval ?? null);
      const oldestIndexedBlockTimestamp = await BlocksRepository.$oldestBlockTimestamp();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());
      res.json({
        oldestIndexedBlockTimestamp: oldestIndexedBlockTimestamp,
        blockFeeRates: blockFeeRates,
      });
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async $getHistoricalBlockSizeAndWeight(req: Request, res: Response) {
    try {
      const blockSizes = await mining.$getHistoricalBlockSizes(req.params.interval ?? null);
      const blockWeights = await mining.$getHistoricalBlockWeights(req.params.interval ?? null);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());
      res.json({
        sizes: blockSizes,
        weights: blockWeights
      });
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async getBlock(req: Request, res: Response) {
    try {
      const block = await blocks.$getBlock(req.params.hash);
      res.json(block);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async getBlockHeader(req: Request, res: Response) {
    try {
      const blockHeader = await bitcoinApi.$getBlockHeader(req.params.hash);
      res.setHeader('content-type', 'text/plain');
      res.send(blockHeader);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async getBlocksExtras(req: Request, res: Response) {
    try {
      const height = req.params.height === undefined ? undefined : parseInt(req.params.height, 10);
      res.json(await blocks.$getBlocksExtras(height, 15));
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
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
      for (let i = 0; i < 10 && nextHash; i++) {
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
      res.status(500).send(e instanceof Error ? e.message : e);
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
          logger.debug('getBlockTransactions error: ' + (e instanceof Error ? e.message : e));
        }
      }
      res.json(transactions);
    } catch (e) {
      loadingIndicators.setProgress('blocktxs-' + req.params.hash, 100);
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async getBlockHeight(req: Request, res: Response) {
    try {
      const blockHash = await bitcoinApi.$getBlockHash(parseInt(req.params.height, 10));
      res.send(blockHash);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
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
      if (e instanceof Error && e.message && (e.message.indexOf('too long') > 0 || e.message.indexOf('confirmed status') > 0)) {
        return res.status(413).send(e instanceof Error ? e.message : e);
      }
      res.status(500).send(e instanceof Error ? e.message : e);
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
      if (e instanceof Error && e.message && (e.message.indexOf('too long') > 0 || e.message.indexOf('confirmed status') > 0)) {
        return res.status(413).send(e instanceof Error ? e.message : e);
      }
      res.status(500).send(e instanceof Error ? e.message : e);
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
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async getRecentMempoolTransactions(req: Request, res: Response) {
    const latestTransactions = Object.entries(mempool.getMempool())
      .sort((a, b) => (b[1].firstSeen || 0) - (a[1].firstSeen || 0))
      .slice(0, 10).map((tx) => Common.stripTransaction(tx[1]));

    res.json(latestTransactions);
  }

  public async getMempool(req: Request, res: Response) {
    const info = mempool.getMempoolInfo();
    res.json({
      count: info.size,
      vsize: info.bytes,
      total_fee: info.total_fee * 1e8,
      fee_histogram: []
    });
  }

  public async getMempoolTxIds(req: Request, res: Response) {
    try {
      const rawMempool = await bitcoinApi.$getRawMempool();
      res.send(rawMempool);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async getBlockTipHeight(req: Request, res: Response) {
    try {
      const result = await bitcoinApi.$getBlockHeightTip();
      res.json(result);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async getTxIdsForBlock(req: Request, res: Response) {
    try {
      const result = await bitcoinApi.$getTxIdsForBlock(req.params.hash);
      res.json(result);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async validateAddress(req: Request, res: Response) {
    try {
      const result = await bitcoinClient.validateAddress(req.params.address);
      res.json(result);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async getTransactionOutspends(req: Request, res: Response) {
    try {
      const result = await bitcoinApi.$getOutspends(req.params.txId);
      res.json(result);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public getDifficultyChange(req: Request, res: Response) {
    try {
      res.json(difficultyAdjustment.getDifficultyAdjustment());
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async $getElementsPegsByMonth(req: Request, res: Response) {
    try {
      const pegs = await elementsParser.$getPegDataByMonth();
      res.json(pegs);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async $postTransaction(req: Request, res: Response) {
    res.setHeader('content-type', 'text/plain');
    try {
      let rawTx;
      if (typeof req.body === 'object') {
        rawTx = Object.keys(req.body)[0];
      } else {
        rawTx = req.body;
      }
      const txIdResult = await bitcoinApi.$sendRawTransaction(rawTx);
      res.send(txIdResult);
    } catch (e: any) {
      res.status(400).send(e.message && e.code ? 'sendrawtransaction RPC error: ' + JSON.stringify({ code: e.code, message: e.message })
        : (e.message || 'Error'));
    }
  }

  public async $postTransactionForm(req: Request, res: Response) {
    res.setHeader('content-type', 'text/plain');
    const matches = /tx=([a-z0-9]+)/.exec(req.body);
    let txHex = '';
    if (matches && matches[1]) {
      txHex = matches[1];
    }
    try {
      const txIdResult = await bitcoinClient.sendRawTransaction(txHex);
      res.send(txIdResult);
    } catch (e: any) {
      res.status(400).send(e.message && e.code ? 'sendrawtransaction RPC error: ' + JSON.stringify({ code: e.code, message: e.message })
        : (e.message || 'Error'));
    }
  }

  public getLiquidIcon(req: Request, res: Response) {
    const result = icons.getIconByAssetId(req.params.assetId);
    if (result) {
      res.setHeader('content-type', 'image/png');
      res.setHeader('content-length', result.length);
      res.send(result);
    } else {
      res.status(404).send('Asset icon not found');
    }
  }

  public getAllLiquidIcon(req: Request, res: Response) {
    const result = icons.getAllIconIds();
    if (result) {
      res.json(result);
    } else {
      res.status(404).send('Asset icons not found');
    }
  }

  public async $getAllFeaturedLiquidAssets(req: Request, res: Response) {
    try {
      const response = await axios.get('https://liquid.network/api/v1/assets/featured', { responseType: 'stream', timeout: 10000 });
      response.data.pipe(res);
    } catch (e) {
      res.status(500).end();
    }
  }

  public async $getAssetGroup(req: Request, res: Response) {
    try {
      const response = await axios.get('https://liquid.network/api/v1/assets/group/' + parseInt(req.params.id, 10),
        { responseType: 'stream', timeout: 10000 });
      response.data.pipe(res);
    } catch (e) {
      res.status(500).end();
    }
  }

  public async $getRewardStats(req: Request, res: Response) {
    try {
      const response = await mining.$getRewardStats(parseInt(req.params.blockCount, 10));
      res.json(response);
    } catch (e) {
      res.status(500).end();
    }
  }
}

export default new Routes();
