import { Application, Request, Response } from 'express';
import axios from 'axios';
import config from '../../config';
import websocketHandler from '../websocket-handler';
import mempool from '../mempool';
import feeApi from '../fee-api';
import mempoolBlocks from '../mempool-blocks';
import bitcoinApi from './bitcoin-api-factory';
import { Common } from '../common';
import backendInfo from '../backend-info';
import transactionUtils from '../transaction-utils';
import { IEsploraApi } from './esplora-api.interface';
import loadingIndicators from '../loading-indicators';
import { TransactionExtended } from '../../mempool.interfaces';
import logger from '../../logger';
import blocks from '../blocks';
import bitcoinClient from './bitcoin-client';
import difficultyAdjustment from '../difficulty-adjustment';

class BitcoinRoutes {
  public initRoutes(app: Application) {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'transaction-times', this.getTransactionTimes)
      .get(config.MEMPOOL.API_URL_PREFIX + 'outspends', this.$getBatchedOutspends)
      .get(config.MEMPOOL.API_URL_PREFIX + 'cpfp/:txId', this.getCpfpInfo)
      .get(config.MEMPOOL.API_URL_PREFIX + 'difficulty-adjustment', this.getDifficultyChange)
      .get(config.MEMPOOL.API_URL_PREFIX + 'fees/recommended', this.getRecommendedFees)
      .get(config.MEMPOOL.API_URL_PREFIX + 'fees/mempool-blocks', this.getMempoolBlocks)
      .get(config.MEMPOOL.API_URL_PREFIX + 'backend-info', this.getBackendInfo)
      .get(config.MEMPOOL.API_URL_PREFIX + 'init-data', this.getInitData)
      .get(config.MEMPOOL.API_URL_PREFIX + 'validate-address/:address', this.validateAddress)
      .post(config.MEMPOOL.API_URL_PREFIX + 'tx/push', this.$postTransactionForm)
      .get(config.MEMPOOL.API_URL_PREFIX + 'donations', async (req, res) => {
        try {
          const response = await axios.get(`${config.EXTERNAL_DATA_SERVER.MEMPOOL_API}/donations`, { responseType: 'stream', timeout: 10000 });
          response.data.pipe(res);
        } catch (e) {
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'donations/images/:id', async (req, res) => {
        try {
          const response = await axios.get(`${config.EXTERNAL_DATA_SERVER.MEMPOOL_API}/donations/images/${req.params.id}`, {
            responseType: 'stream', timeout: 10000
          });
          response.data.pipe(res);
        } catch (e) {
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'contributors', async (req, res) => {
        try {
          const response = await axios.get(`${config.EXTERNAL_DATA_SERVER.MEMPOOL_API}/contributors`, { responseType: 'stream', timeout: 10000 });
          response.data.pipe(res);
        } catch (e) {
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'contributors/images/:id', async (req, res) => {
        try {
          const response = await axios.get(`${config.EXTERNAL_DATA_SERVER.MEMPOOL_API}/contributors/images/${req.params.id}`, {
            responseType: 'stream', timeout: 10000
          });
          response.data.pipe(res);
        } catch (e) {
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'translators', async (req, res) => {
        try {
          const response = await axios.get(`${config.EXTERNAL_DATA_SERVER.MEMPOOL_API}/translators`, { responseType: 'stream', timeout: 10000 });
          response.data.pipe(res);
        } catch (e) {
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'translators/images/:id', async (req, res) => {
        try {
          const response = await axios.get(`${config.EXTERNAL_DATA_SERVER.MEMPOOL_API}/translators/images/${req.params.id}`, {
            responseType: 'stream', timeout: 10000
          });
          response.data.pipe(res);
        } catch (e) {
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'blocks', this.getBlocks.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'blocks/:height', this.getBlocks.bind(this))
      .get(config.MEMPOOL.API_URL_PREFIX + 'block/:hash', this.getBlock)
      .get(config.MEMPOOL.API_URL_PREFIX + 'block/:hash/summary', this.getStrippedBlockTransactions);
      ;

      if (config.MEMPOOL.BACKEND !== 'esplora') {
        app
          .get(config.MEMPOOL.API_URL_PREFIX + 'mempool', this.getMempool)
          .get(config.MEMPOOL.API_URL_PREFIX + 'mempool/txids', this.getMempoolTxIds)
          .get(config.MEMPOOL.API_URL_PREFIX + 'mempool/recent', this.getRecentMempoolTransactions)
          .get(config.MEMPOOL.API_URL_PREFIX + 'tx/:txId', this.getTransaction)
          .post(config.MEMPOOL.API_URL_PREFIX + 'tx', this.$postTransaction)
          .get(config.MEMPOOL.API_URL_PREFIX + 'tx/:txId/hex', this.getRawTransaction)
          .get(config.MEMPOOL.API_URL_PREFIX + 'tx/:txId/status', this.getTransactionStatus)
          .get(config.MEMPOOL.API_URL_PREFIX + 'tx/:txId/outspends', this.getTransactionOutspends)
          .get(config.MEMPOOL.API_URL_PREFIX + 'block/:hash/header', this.getBlockHeader)
          .get(config.MEMPOOL.API_URL_PREFIX + 'blocks/tip/height', this.getBlockTipHeight)
          .get(config.MEMPOOL.API_URL_PREFIX + 'blocks/tip/hash', this.getBlockTipHash)
          .get(config.MEMPOOL.API_URL_PREFIX + 'block/:hash/raw', this.getRawBlock)
          .get(config.MEMPOOL.API_URL_PREFIX + 'block/:hash/txids', this.getTxIdsForBlock)
          .get(config.MEMPOOL.API_URL_PREFIX + 'block/:hash/txs', this.getBlockTransactions)
          .get(config.MEMPOOL.API_URL_PREFIX + 'block/:hash/txs/:index', this.getBlockTransactions)
          .get(config.MEMPOOL.API_URL_PREFIX + 'block-height/:height', this.getBlockHeight)
          .get(config.MEMPOOL.API_URL_PREFIX + 'address/:address', this.getAddress)
          .get(config.MEMPOOL.API_URL_PREFIX + 'address/:address/txs', this.getAddressTransactions)
          .get(config.MEMPOOL.API_URL_PREFIX + 'address/:address/txs/chain/:txId', this.getAddressTransactions)
          .get(config.MEMPOOL.API_URL_PREFIX + 'address-prefix/:prefix', this.getAddressPrefix)
          ;
      }
  }


  private getInitData(req: Request, res: Response) {
    try {
      const result = websocketHandler.getInitData();
      res.json(result);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private getRecommendedFees(req: Request, res: Response) {
    if (!mempool.isInSync()) {
      res.statusCode = 503;
      res.send('Service Unavailable');
      return;
    }
    const result = feeApi.getRecommendedFee();
    res.json(result);
  }

  private getMempoolBlocks(req: Request, res: Response) {
    try {
      const result = mempoolBlocks.getMempoolBlocks();
      res.json(result);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private getTransactionTimes(req: Request, res: Response) {
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

  private async $getBatchedOutspends(req: Request, res: Response) {
    if (!Array.isArray(req.query.txId)) {
      res.status(500).send('Not an array');
      return;
    }
    if (req.query.txId.length > 50) {
      res.status(400).send('Too many txids requested');
      return;
    }
    const txIds: string[] = [];
    for (const _txId in req.query.txId) {
      if (typeof req.query.txId[_txId] === 'string') {
        txIds.push(req.query.txId[_txId].toString());
      }
    }

    try {
      const batchedOutspends = await bitcoinApi.$getBatchedOutspends(txIds);
      res.json(batchedOutspends);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private getCpfpInfo(req: Request, res: Response) {
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

  private getBackendInfo(req: Request, res: Response) {
    res.json(backendInfo.getBackendInfo());
  }

  private async getTransaction(req: Request, res: Response) {
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

  private async getRawTransaction(req: Request, res: Response) {
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

  private async getTransactionStatus(req: Request, res: Response) {
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

  private async getBlock(req: Request, res: Response) {
    try {
      const block = await blocks.$getBlock(req.params.hash);

      const blockAge = new Date().getTime() / 1000 - block.timestamp;
      const day = 24 * 3600;
      let cacheDuration;
      if (blockAge > 365 * day) {
        cacheDuration = 30 * day;
      } else if (blockAge > 30 * day) {
        cacheDuration = 10 * day;
      } else {
        cacheDuration = 600
      }

      res.setHeader('Expires', new Date(Date.now() + 1000 * cacheDuration).toUTCString());
      res.json(block);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async getBlockHeader(req: Request, res: Response) {
    try {
      const blockHeader = await bitcoinApi.$getBlockHeader(req.params.hash);
      res.setHeader('content-type', 'text/plain');
      res.send(blockHeader);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async getStrippedBlockTransactions(req: Request, res: Response) {
    try {
      const transactions = await blocks.$getStrippedBlockTransactions(req.params.hash);
      res.setHeader('Expires', new Date(Date.now() + 1000 * 3600 * 24 * 30).toUTCString());
      res.json(transactions);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async getBlocks(req: Request, res: Response) {
    try {
      if (['mainnet', 'testnet', 'signet'].includes(config.MEMPOOL.NETWORK)) { // Bitcoin
        const height = req.params.height === undefined ? undefined : parseInt(req.params.height, 10);
        res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
        res.json(await blocks.$getBlocks(height, 15));
      } else { // Liquid, Bisq
        return await this.getLegacyBlocks(req, res);
      }
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async getLegacyBlocks(req: Request, res: Response) {
    try {
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
      }

      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(returnBlocks);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }
  
  private async getBlockTransactions(req: Request, res: Response) {
    try {
      loadingIndicators.setProgress('blocktxs-' + req.params.hash, 0);

      const txIds = await bitcoinApi.$getTxIdsForBlock(req.params.hash);
      const transactions: TransactionExtended[] = [];
      const startingIndex = Math.max(0, parseInt(req.params.index || '0', 10));

      const endIndex = Math.min(startingIndex + 10, txIds.length);
      for (let i = startingIndex; i < endIndex; i++) {
        try {
          const transaction = await transactionUtils.$getTransactionExtended(txIds[i], true, true);
          transactions.push(transaction);
          loadingIndicators.setProgress('blocktxs-' + req.params.hash, (i - startingIndex + 1) / (endIndex - startingIndex) * 100);
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

  private async getBlockHeight(req: Request, res: Response) {
    try {
      const blockHash = await bitcoinApi.$getBlockHash(parseInt(req.params.height, 10));
      res.send(blockHash);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async getAddress(req: Request, res: Response) {
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

  private async getAddressTransactions(req: Request, res: Response) {
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

  private async getAdressTxChain(req: Request, res: Response) {
    res.status(501).send('Not implemented');
  }

  private async getAddressPrefix(req: Request, res: Response) {
    try {
      const blockHash = await bitcoinApi.$getAddressPrefix(req.params.prefix);
      res.send(blockHash);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async getRecentMempoolTransactions(req: Request, res: Response) {
    const latestTransactions = Object.entries(mempool.getMempool())
      .sort((a, b) => (b[1].firstSeen || 0) - (a[1].firstSeen || 0))
      .slice(0, 10).map((tx) => Common.stripTransaction(tx[1]));

    res.json(latestTransactions);
  }

  private async getMempool(req: Request, res: Response) {
    const info = mempool.getMempoolInfo();
    res.json({
      count: info.size,
      vsize: info.bytes,
      total_fee: info.total_fee * 1e8,
      fee_histogram: []
    });
  }

  private async getMempoolTxIds(req: Request, res: Response) {
    try {
      const rawMempool = await bitcoinApi.$getRawMempool();
      res.send(rawMempool);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async getBlockTipHeight(req: Request, res: Response) {
    try {
      const result = await bitcoinApi.$getBlockHeightTip();
      res.json(result);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async getBlockTipHash(req: Request, res: Response) {
    try {
      const result = await bitcoinApi.$getBlockHashTip();
      res.setHeader('content-type', 'text/plain');
      res.send(result);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async getRawBlock(req: Request, res: Response) {
    try {
      const result = await bitcoinApi.$getRawBlock(req.params.hash);
      res.setHeader('content-type', 'application/octet-stream');
      res.send(result);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async getTxIdsForBlock(req: Request, res: Response) {
    try {
      const result = await bitcoinApi.$getTxIdsForBlock(req.params.hash);
      res.json(result);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async validateAddress(req: Request, res: Response) {
    try {
      const result = await bitcoinClient.validateAddress(req.params.address);
      res.json(result);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async getTransactionOutspends(req: Request, res: Response) {
    try {
      const result = await bitcoinApi.$getOutspends(req.params.txId);
      res.json(result);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private getDifficultyChange(req: Request, res: Response) {
    try {
      const da = difficultyAdjustment.getDifficultyAdjustment();
      if (da) {
        res.json(da);
      } else {
        res.status(503).send(`Service Temporarily Unavailable`);
      }
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $postTransaction(req: Request, res: Response) {
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

  private async $postTransactionForm(req: Request, res: Response) {
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

}

export default new BitcoinRoutes();
