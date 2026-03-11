import http from 'http';

export interface RpcConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

interface RpcResponse {
  result: any;
  error: { code: number; message: string } | null;
  id: string;
}

export class RpcClient {
  private config: RpcConfig;
  private idCounter = 0;

  constructor(config: RpcConfig) {
    this.config = config;
  }

  private async call(method: string, params: any[] = []): Promise<any> {
    const id = String(++this.idCounter);
    const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    const auth = Buffer.from(`${this.config.user}:${this.config.pass}`).toString('base64');

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: this.config.host,
          port: this.config.port,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const parsed: RpcResponse = JSON.parse(data);
              if (parsed.error) {
                reject(new Error(`RPC error ${parsed.error.code}: ${parsed.error.message}`));
              } else {
                resolve(parsed.result);
              }
            } catch (e) {
              reject(new Error(`Failed to parse RPC response: ${data.slice(0, 500)}`));
            }
          });
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  async getRawMempool(): Promise<string[]> {
    return this.call('getrawmempool');
  }

  async getRawTransaction(txid: string, verbose = true): Promise<any> {
    return this.call('getrawtransaction', [txid, verbose]);
  }

  async getBlockTemplate(rules: string[] = ['segwit']): Promise<any> {
    return this.call('getblocktemplate', [{ rules }]);
  }

  async getMempoolEntry(txid: string): Promise<any> {
    return this.call('getmempoolentry', [txid]);
  }

  async getMempoolCluster(txid: string): Promise<any> {
    return this.call('getmempoolcluster', [txid]);
  }

  async getBlockCount(): Promise<number> {
    return this.call('getblockcount');
  }

  async batch(calls: { method: string; params: any[] }[]): Promise<any[]> {
    if (calls.length === 0) {
      return [];
    }
    const bodies = calls.map((c) => ({
      jsonrpc: '2.0',
      id: String(++this.idCounter),
      method: c.method,
      params: c.params,
    }));
    const body = JSON.stringify(bodies);
    const auth = Buffer.from(`${this.config.user}:${this.config.pass}`).toString('base64');

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: this.config.host,
          port: this.config.port,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const parsed: RpcResponse[] = JSON.parse(data);
              const results = parsed.map((r) => {
                if (r.error) {
                  return { error: r.error };
                }
                return r.result;
              });
              resolve(results);
            } catch (e) {
              reject(new Error(`Failed to parse batch RPC response: ${data.slice(0, 500)}`));
            }
          });
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}
