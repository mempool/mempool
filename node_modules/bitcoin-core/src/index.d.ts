declare module 'bitcoin-core' {

  interface Auth {
    pass?: string;
    user?: string;
  }

  interface MethodFeature {
    supported: boolean;
  }

  interface Method {
    features: Record<string, MethodFeature>;
    supported: boolean;
  }

  interface RequesterConfig {
    methods: Record<string, Method>;
    version?: string;
  }

  interface Parser {
    rpc(response: any): any;
    rest(extension: string, response: any): any;
  }

  interface RequestConfig {
    baseUrl: string;
    headers: Record<string, string>;
    timeout: number;
  }

  interface Request {
    getAsync(url: string, options?: Record<string, any>): Promise<any>;
    postAsync(url: string, options?: Record<string, any>): Promise<any>;
    defaults(config: RequestConfig): Request;
  }

  interface ClientConfig {
    headers?: Record<string, string>;
    host?: string;
    logger?: any;
    password?: string;
    timeout?: number;
    username?: string;
    version?: string;
    wallet?: string;
    allowDefaultWallet?: boolean;
  }

  interface ReturnFormatOptions {
    extension?: 'json' | 'bin' | 'hex';
  }

  interface BlockHashOptions extends ReturnFormatOptions {
    summary?: boolean;
  }

  interface UnspentTransactionOutput {
    id: string;
    index: number;
  }

  class Client {
    auth: Auth | null;
    hasNamedParametersSupport: boolean;
    headers: Record<string, string>;
    host: string;
    password?: string;
    timeout: number;
    wallet?: string;
    version?: string;

    methods: Record<string, Method>;
    request: Request;
    requester: any; // Assume Requester type
    parser: Parser;

    constructor(config?: ClientConfig);

    command<T = any>(...args: any[]): Promise<T>;

    getTransactionByHash<T = any>(
      hash: string,
      options?: ReturnFormatOptions
    ): Promise<T>;

    getBlockByHash<T = any>(
      hash: string,
      options?: BlockHashOptions
    ): Promise<T>;

    getBlockHeadersByHash<T = any>(
      hash: string,
      count: number,
      options?: ReturnFormatOptions
    ): Promise<T>;

    getBlockchainInformation<T = any>(): Promise<T>;

    getUnspentTransactionOutputs<T = any>(
      outpoints: UnspentTransactionOutput[],
      options?: ReturnFormatOptions
    ): Promise<T>;

    getMemoryPoolContent<T = any>(): Promise<T>;

    getMemoryPoolInformation<T = any>(): Promise<T>;
  }

  export = Client;
}
