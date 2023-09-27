// Imported from https://github.com/shesek/lightning-client-js

'use strict';

const methods = [
  'addgossip',
  'autocleaninvoice',
  'check',
  'checkmessage',
  'close',
  'connect',
  'createinvoice',
  'createinvoicerequest',
  'createoffer',
  'createonion',
  'decode',
  'decodepay',
  'delexpiredinvoice',
  'delinvoice',
  'delpay',
  'dev-listaddrs',
  'dev-rescan-outputs',
  'disableoffer',
  'disconnect',
  'estimatefees',
  'feerates',
  'fetchinvoice',
  'fundchannel',
  'fundchannel_cancel',
  'fundchannel_complete',
  'fundchannel_start',
  'fundpsbt',
  'getchaininfo',
  'getinfo',
  'getlog',
  'getrawblockbyheight',
  'getroute',
  'getsharedsecret',
  'getutxout',
  'help',
  'invoice',
  'keysend',
  'legacypay',
  'listchannels',
  'listconfigs',
  'listforwards',
  'listfunds',
  'listinvoices',
  'listnodes',
  'listoffers',
  'listpays',
  'listpeers',
  'listsendpays',
  'listtransactions',
  'multifundchannel',
  'multiwithdraw',
  'newaddr',
  'notifications',
  'offer',
  'offerout',
  'openchannel_abort',
  'openchannel_bump',
  'openchannel_init',
  'openchannel_signed',
  'openchannel_update',
  'pay',
  'payersign',
  'paystatus',
  'ping',
  'plugin',
  'reserveinputs',
  'sendinvoice',
  'sendonion',
  'sendonionmessage',
  'sendpay',
  'sendpsbt',
  'sendrawtransaction',
  'setchannelfee',
  'signmessage',
  'signpsbt',
  'stop',
  'txdiscard',
  'txprepare',
  'txsend',
  'unreserveinputs',
  'utxopsbt',
  'waitanyinvoice',
  'waitblockheight',
  'waitinvoice',
  'waitsendpay',
  'withdraw'
];


import EventEmitter from 'events';
import { existsSync, statSync } from 'fs';
import { createConnection, Socket } from 'net';
import { homedir } from 'os';
import path from 'path';
import { createInterface, Interface } from 'readline';
import logger from '../../../logger';
import { AbstractLightningApi } from '../lightning-api-abstract-factory';
import { ILightningApi } from '../lightning-api.interface';
import { convertAndmergeBidirectionalChannels, convertNode } from './clightning-convert';

class LightningError extends Error {
  type: string = 'lightning';
  message: string = 'lightning-client error';

  constructor(error) {
    super();
    this.type = error.type;
    this.message = error.message;
  }
}

const defaultRpcPath = path.join(homedir(), '.lightning')
  , fStat = (...p) => statSync(path.join(...p))
  , fExists = (...p) => existsSync(path.join(...p))

export default class CLightningClient extends EventEmitter implements AbstractLightningApi {
  private rpcPath: string;
  private reconnectWait: number;
  private reconnectTimeout;
  private reqcount: number;
  private client: Socket;
  private rl: Interface;
  private clientConnectionPromise: Promise<unknown>;

  constructor(rpcPath = defaultRpcPath) {
    if (!path.isAbsolute(rpcPath)) {
      throw new Error('The rpcPath must be an absolute path');
    }

    if (!fExists(rpcPath) || !fStat(rpcPath).isSocket()) {
      // network directory provided, use the lightning-rpc within in
      if (fExists(rpcPath, 'lightning-rpc')) {
        rpcPath = path.join(rpcPath, 'lightning-rpc');
      }

      // main data directory provided, default to using the bitcoin mainnet subdirectory
      // to be removed in v0.2.0
      else if (fExists(rpcPath, 'bitcoin', 'lightning-rpc')) {
        logger.warn(`${rpcPath}/lightning-rpc is missing, using the bitcoin mainnet subdirectory at ${rpcPath}/bitcoin instead.`, logger.tags.ln)
        logger.warn(`specifying the main lightning data directory is deprecated, please specify the network directory explicitly.\n`, logger.tags.ln)
        rpcPath = path.join(rpcPath, 'bitcoin', 'lightning-rpc')
      }
    }

    logger.debug(`Connecting to ${rpcPath}`, logger.tags.ln);

    super();
    this.rpcPath = rpcPath;
    this.reconnectWait = 0.5;
    this.reconnectTimeout = null;
    this.reqcount = 0;

    const _self = this;

    this.client = createConnection(rpcPath).on(
      'error', () => {
        _self.increaseWaitTime();
        _self.reconnect();
      }
    );
    this.rl = createInterface({ input: this.client }).on(
      'error', () => {
        _self.increaseWaitTime();
        _self.reconnect();
      }
    );

    this.clientConnectionPromise = new Promise<void>(resolve => {
      _self.client.on('connect', () => {
        logger.info(`CLightning client connected`, logger.tags.ln);
        _self.reconnectWait = 1;
        resolve();
      });

      _self.client.on('end', () => {
        logger.err(`CLightning client connection closed, reconnecting`, logger.tags.ln);
        _self.increaseWaitTime();
        _self.reconnect();
      });

      _self.client.on('error', error => {
        logger.err(`CLightning client connection error: ${error}`, logger.tags.ln);
        _self.increaseWaitTime();
        _self.reconnect();
      });
    });

    this.rl.on('line', line => {
      line = line.trim();
      if (!line) {
        return;
      }
      const data = JSON.parse(line);
      _self.emit('res:' + data.id, data);
    });
  }

  increaseWaitTime(): void {
    if (this.reconnectWait >= 16) {
      this.reconnectWait = 16;
    } else {
      this.reconnectWait *= 2;
    }
  }

  reconnect(): void {
    const _self = this;

    if (this.reconnectTimeout) {
      return;
    }

    this.reconnectTimeout = setTimeout(() => {
      logger.debug(`Trying to reconnect...`, logger.tags.ln);

      _self.client.connect(_self.rpcPath);
      _self.reconnectTimeout = null;
    }, this.reconnectWait * 1000);
  }

  call(method, args = []): Promise<any> {
    const _self = this;

    const callInt = ++this.reqcount;
    const sendObj = {
      jsonrpc: '2.0',
      method,
      params: args,
      id: '' + callInt
    };


    // Wait for the client to connect
    return this.clientConnectionPromise
      .then(() => new Promise((resolve, reject) => {
        // Wait for a response
        this.once('res:' + callInt, res => res.error == null
          ? resolve(res.result)
          : reject(new LightningError(res.error))
        );

        // Send the command
        _self.client.write(JSON.stringify(sendObj));
      }));
  }

  async $getNetworkGraph(): Promise<ILightningApi.NetworkGraph> {
    const listnodes: any[] = await this.call('listnodes');
    const listchannels: any[] = await this.call('listchannels');
    const channelsList = await convertAndmergeBidirectionalChannels(listchannels['channels']);

    return {
      nodes: listnodes['nodes'].map(node => convertNode(node)),
      edges: channelsList,
    };
  }
}

const protify = s => s.replace(/-([a-z])/g, m => m[1].toUpperCase());

methods.forEach(k => {
  CLightningClient.prototype[protify(k)] = function (...args: any) {
    return this.call(k, args);
  };
});
