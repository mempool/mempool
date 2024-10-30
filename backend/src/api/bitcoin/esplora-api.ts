import config from '../../config';
import axios, { AxiosResponse, isAxiosError } from 'axios';
import http from 'http';
import { AbstractBitcoinApi, HealthCheckHost } from './bitcoin-api-abstract-factory';
import { IEsploraApi } from './esplora-api.interface';
import logger from '../../logger';
import { Common } from '../common';
import { SubmitPackageResult, TestMempoolAcceptResult } from './bitcoin-api.interface';

interface FailoverHost {
  host: string,
  rtts: number[],
  rtt: number,
  timedOut?: boolean,
  failures: number,
  latestHeight?: number,
  socket?: boolean,
  outOfSync?: boolean,
  unreachable?: boolean,
  preferred?: boolean,
  checked: boolean,
  lastChecked?: number,
}

class FailoverRouter {
  activeHost: FailoverHost;
  fallbackHost: FailoverHost;
  maxSlippage: number = config.ESPLORA.MAX_BEHIND_TIP ?? 2;
  maxHeight: number = 0;
  hosts: FailoverHost[];
  multihost: boolean;
  pollInterval: number = 60000;
  pollTimer: NodeJS.Timeout | null = null;
  pollConnection = axios.create();
  requestConnection = axios.create({
    httpAgent: new http.Agent({ keepAlive: true })
  });

  constructor() {
    // setup list of hosts
    this.hosts = (config.ESPLORA.FALLBACK || []).map(domain => {
      return {
        host: domain,
        checked: false,
        rtts: [],
        rtt: Infinity,
        failures: 0,
      };
    });
    this.activeHost = {
      host: config.ESPLORA.UNIX_SOCKET_PATH || config.ESPLORA.REST_API_URL,
      rtts: [],
      rtt: 0,
      failures: 0,
      socket: !!config.ESPLORA.UNIX_SOCKET_PATH,
      preferred: true,
      checked: false,
    };
    this.fallbackHost = this.activeHost;
    this.hosts.unshift(this.activeHost);
    this.multihost = this.hosts.length > 1;
  }

  public startHealthChecks(): void {
    // use axios interceptors to measure request rtt
    this.pollConnection.interceptors.request.use((config) => {
      config['meta'] = { startTime: Date.now() };
      return config;
    });
    this.pollConnection.interceptors.response.use((response) => {
      response.config['meta'].rtt = Date.now() - response.config['meta'].startTime;
      return response;
    });

    if (this.multihost) {
      this.pollHosts();
    }
  }

  // start polling hosts to measure availability & rtt
  private async pollHosts(): Promise<void> {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
    }

    const start = Date.now();

    // update rtts & sync status
    for (const host of this.hosts) {
      try {
        const result = await (host.socket
          ? this.pollConnection.get<number>('/blocks/tip/height', { socketPath: host.host, timeout: config.ESPLORA.FALLBACK_TIMEOUT })
          : this.pollConnection.get<number>(host.host + '/blocks/tip/height', { timeout: config.ESPLORA.FALLBACK_TIMEOUT })
        );
        if (result) {
          const height = result.data;
          host.latestHeight = height;
          this.maxHeight = Math.max(height || 0, ...this.hosts.map(h => (!(h.unreachable || h.timedOut || h.outOfSync) ? h.latestHeight || 0 : 0)));
          const rtt = result.config['meta'].rtt;
          host.rtts.unshift(rtt);
          host.rtts.slice(0, 5);
          host.rtt = host.rtts.reduce((acc, l) => acc + l, 0) / host.rtts.length;
          if (height == null || isNaN(height) || (this.maxHeight - height > this.maxSlippage)) {
            host.outOfSync = true;
          } else {
            host.outOfSync = false;
          }
          host.unreachable = false;
        } else {
          host.outOfSync = true;
          host.unreachable = true;
          host.rtts = [];
          host.rtt = Infinity;
        }
        host.timedOut = false;
      } catch (e) {
        host.outOfSync = true;
        host.unreachable = true;
        host.rtts = [];
        host.rtt = Infinity;
        if (isAxiosError(e) && (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT')) {
          host.timedOut = true;
        } else {
          host.timedOut = false;
        }
      }
      host.checked = true;
      host.lastChecked = Date.now();

      const rankOrder = this.sortHosts();
      // switch if the current host is out of sync or significantly slower than the next best alternative
      if (this.activeHost.outOfSync || this.activeHost.unreachable || (this.activeHost !== rankOrder[0] && rankOrder[0].preferred) || (!this.activeHost.preferred && this.activeHost.rtt > (rankOrder[0].rtt * 2) + 50)) {
        if (this.activeHost.unreachable) {
          logger.warn(`🚨🚨🚨 Unable to reach ${this.activeHost.host}, failing over to next best alternative 🚨🚨🚨`);
        } else if (this.activeHost.outOfSync) {
          logger.warn(`🚨🚨🚨 ${this.activeHost.host} has fallen behind, failing over to next best alternative 🚨🚨🚨`);
        } else {
          logger.debug(`🛠️ ${this.activeHost.host} is no longer the best esplora host 🛠️`);
        }
        this.electHost();
      }
      await Common.sleep$(50);
    }

    const rankOrder = this.updateFallback();
    logger.debug(`Tomahawk ranking:\n${rankOrder.map((host, index) => this.formatRanking(index, host, this.activeHost, this.maxHeight)).join('\n')}`);

    const elapsed = Date.now() - start;

    this.pollTimer = setTimeout(() => { this.pollHosts(); }, Math.max(1, this.pollInterval - elapsed));
  }

  private formatRanking(index: number, host: FailoverHost, active: FailoverHost, maxHeight: number): string {
    const heightStatus = !host.checked ? '⏳' : (host.outOfSync ? '🚫' : (host.latestHeight && host.latestHeight < maxHeight ? '🟧' : '✅'));
    return `${host === active ? '⭐️' : '  '} ${host.rtt < Infinity ? Math.round(host.rtt).toString().padStart(5, ' ') + 'ms' : (host.timedOut ? '  ⌛️💥 ' : '    -  ')} ${!host.checked ? '⏳' : (host.unreachable ? '🔥' : '✅')} | block: ${host.latestHeight || '??????'} ${heightStatus} | ${host.host} ${host === active ? '⭐️' : '  '}`;
  }

  private updateFallback(): FailoverHost[] {
    const rankOrder = this.sortHosts();
    if (rankOrder.length > 1 && rankOrder[0] === this.activeHost) {
      this.fallbackHost = rankOrder[1];
    } else {
      this.fallbackHost = rankOrder[0];
    }
    return rankOrder;
  }

  // sort hosts by connection quality, and update default fallback
  public sortHosts(): FailoverHost[] {
    // sort by connection quality
    return this.hosts.slice().sort((a, b) => {
      if ((a.unreachable || a.outOfSync) === (b.unreachable || b.outOfSync)) {
        if  (a.preferred === b.preferred) {
          // lower rtt is best
          return a.rtt - b.rtt;
        } else { // unless we have a preferred host
          return a.preferred ? -1 : 1;
        }
      } else { // or the host is out of sync
        return (a.unreachable || a.outOfSync) ? 1 : -1;
      }
    });
  }

  // depose the active host and choose the next best replacement
  private electHost(): void {
    this.activeHost.failures = 0;
    const rankOrder = this.sortHosts();
    this.activeHost = rankOrder[0];
    logger.warn(`Switching esplora host to ${this.activeHost.host}`);
  }

  private addFailure(host: FailoverHost): FailoverHost {
    host.failures++;
    if (host.failures > 5 && this.multihost) {
      logger.warn(`🚨🚨🚨 Too many esplora failures on ${this.activeHost.host}, falling back to next best alternative 🚨🚨🚨`);
      this.activeHost.unreachable = true;
      this.electHost();
      return this.activeHost;
    } else {
      return this.fallbackHost;
    }
  }

  private async $query<T>(method: 'get'| 'post', path, data: any, responseType = 'json', host = this.activeHost, retry: boolean = true): Promise<T> {
    let axiosConfig;
    let url;
    if (host.socket) {
      axiosConfig = { socketPath: host.host, timeout: config.ESPLORA.REQUEST_TIMEOUT, responseType };
      url = path;
    } else {
      axiosConfig = { timeout: config.ESPLORA.REQUEST_TIMEOUT, responseType };
      url = host.host + path;
    }
    if (data?.params) {
      axiosConfig.params = data.params;
    }
    return (method === 'post'
        ? this.requestConnection.post<T>(url, data, axiosConfig)
        : this.requestConnection.get<T>(url, axiosConfig)
    ).then((response) => { host.failures = Math.max(0, host.failures - 1); return response.data; })
      .catch((e) => {
        let fallbackHost = this.fallbackHost;
        if (e?.response?.status !== 404) {
          logger.warn(`esplora request failed ${e?.response?.status} ${host.host}${path}`);
          logger.warn(e instanceof Error ? e.message : e);
          fallbackHost = this.addFailure(host);
        }
        if (retry && e?.code === 'ECONNREFUSED' && this.multihost) {
          // Retry immediately
          return this.$query(method, path, data, responseType, fallbackHost, false);
        } else {
          throw e;
        }
      });
  }

  public async $get<T>(path, responseType = 'json', params: any = null): Promise<T> {
    return this.$query<T>('get', path, params ? { params } : null, responseType);
  }

  public async $post<T>(path, data: any, responseType = 'json'): Promise<T> {
    return this.$query<T>('post', path, data, responseType);
  }
}

class ElectrsApi implements AbstractBitcoinApi {
  private failoverRouter = new FailoverRouter();

  $getRawMempool(): Promise<IEsploraApi.Transaction['txid'][]> {
    return this.failoverRouter.$get<IEsploraApi.Transaction['txid'][]>('/mempool/txids');
  }

  $getRawTransaction(txId: string): Promise<IEsploraApi.Transaction> {
    return this.failoverRouter.$get<IEsploraApi.Transaction>('/tx/' + txId);
  }

  async $getRawTransactions(txids: string[]): Promise<IEsploraApi.Transaction[]> {
    return this.failoverRouter.$post<IEsploraApi.Transaction[]>('/internal/txs', txids, 'json');
  }

  async $getMempoolTransactions(txids: string[]): Promise<IEsploraApi.Transaction[]> {
    return this.failoverRouter.$post<IEsploraApi.Transaction[]>('/internal/mempool/txs', txids, 'json');
  }

  async $getAllMempoolTransactions(lastSeenTxid?: string, max_txs?: number): Promise<IEsploraApi.Transaction[]> {
    return this.failoverRouter.$get<IEsploraApi.Transaction[]>('/internal/mempool/txs' + (lastSeenTxid ? '/' + lastSeenTxid : ''), 'json', max_txs ? { max_txs } : null);
  }

  $getTransactionHex(txId: string): Promise<string> {
    return this.failoverRouter.$get<string>('/tx/' + txId + '/hex');
  }

  $getBlockHeightTip(): Promise<number> {
    return this.failoverRouter.$get<number>('/blocks/tip/height');
  }

  $getBlockHashTip(): Promise<string> {
    return this.failoverRouter.$get<string>('/blocks/tip/hash');
  }

  $getTxIdsForBlock(hash: string): Promise<string[]> {
    return this.failoverRouter.$get<string[]>('/block/' + hash + '/txids');
  }

  $getTxsForBlock(hash: string): Promise<IEsploraApi.Transaction[]> {
    return this.failoverRouter.$get<IEsploraApi.Transaction[]>('/internal/block/' + hash + '/txs');
  }

  $getBlockHash(height: number): Promise<string> {
    return this.failoverRouter.$get<string>('/block-height/' + height);
  }

  $getBlockHeader(hash: string): Promise<string> {
    return this.failoverRouter.$get<string>('/block/' + hash + '/header');
  }

  $getBlock(hash: string): Promise<IEsploraApi.Block> {
    return this.failoverRouter.$get<IEsploraApi.Block>('/block/' + hash);
  }

  $getRawBlock(hash: string): Promise<Buffer> {
    return this.failoverRouter.$get<any>('/block/' + hash + '/raw', 'arraybuffer')
      .then((response) => { return Buffer.from(response.data); });
  }

  $getAddress(address: string): Promise<IEsploraApi.Address> {
    return this.failoverRouter.$get<IEsploraApi.Address>('/address/' + address);
  }

  $getAddressTransactions(address: string, txId?: string): Promise<IEsploraApi.Transaction[]> {
    throw new Error('Method getAddressTransactions not implemented.');
  }

  $getScriptHash(scripthash: string): Promise<IEsploraApi.ScriptHash> {
    throw new Error('Method getScriptHash not implemented.');
  }

  $getScriptHashTransactions(scripthash: string, txId?: string): Promise<IEsploraApi.Transaction[]> {
    throw new Error('Method getScriptHashTransactions not implemented.');
  }

  $getAddressPrefix(prefix: string): string[] {
    throw new Error('Method not implemented.');
  }

  $sendRawTransaction(rawTransaction: string): Promise<string> {
    throw new Error('Method not implemented.');
  }

  $testMempoolAccept(rawTransactions: string[], maxfeerate?: number): Promise<TestMempoolAcceptResult[]> {
    throw new Error('Method not implemented.');
  }

  $submitPackage(rawTransactions: string[]): Promise<SubmitPackageResult> {
    throw new Error('Method not implemented.');
  }

  $getOutspend(txId: string, vout: number): Promise<IEsploraApi.Outspend> {
    return this.failoverRouter.$get<IEsploraApi.Outspend>('/tx/' + txId + '/outspend/' + vout);
  }

  $getOutspends(txId: string): Promise<IEsploraApi.Outspend[]> {
    return this.failoverRouter.$get<IEsploraApi.Outspend[]>('/tx/' + txId + '/outspends');
  }

  async $getBatchedOutspends(txids: string[]): Promise<IEsploraApi.Outspend[][]> {
    throw new Error('Method not implemented.');
  }

  async $getBatchedOutspendsInternal(txids: string[]): Promise<IEsploraApi.Outspend[][]> {
    return this.failoverRouter.$post<IEsploraApi.Outspend[][]>('/internal/txs/outspends/by-txid', txids, 'json');
  }

  async $getOutSpendsByOutpoint(outpoints: { txid: string, vout: number }[]): Promise<IEsploraApi.Outspend[]> {
    return this.failoverRouter.$post<IEsploraApi.Outspend[]>('/internal/txs/outspends/by-outpoint', outpoints.map(out => `${out.txid}:${out.vout}`), 'json');
  }

  async $getCoinbaseTx(blockhash: string): Promise<IEsploraApi.Transaction> {
    const txid = await this.failoverRouter.$get<string>(`/block/${blockhash}/txid/0`);
    return this.failoverRouter.$get<IEsploraApi.Transaction>('/tx/' + txid);
  }

  async $getAddressTransactionSummary(address: string): Promise<IEsploraApi.AddressTxSummary[]> {
    return this.failoverRouter.$get<IEsploraApi.AddressTxSummary[]>('/address/' + address + '/txs/summary');
  }

  public startHealthChecks(): void {
    this.failoverRouter.startHealthChecks();
  }

  public getHealthStatus(): HealthCheckHost[] {
    if (config.MEMPOOL.OFFICIAL) {
      return this.failoverRouter.sortHosts().map(host => ({
        host: host.host,
        active: host === this.failoverRouter.activeHost,
        rtt: host.rtt,
        latestHeight: host.latestHeight || 0,
        socket: !!host.socket,
        outOfSync: !!host.outOfSync,
        unreachable: !!host.unreachable,
        checked: !!host.checked,
        lastChecked: host.lastChecked || 0,
      }));
    } else {
      return [];
    }
  }
}

export default ElectrsApi;
