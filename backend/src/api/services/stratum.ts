import { WebSocket } from 'ws';
import logger from '../../logger';
import config from '../../config';
import websocketHandler from '../websocket-handler';

export interface StratumJob {
  pool: number;
  height: number;
  coinbase: string;
  scriptsig: string;
  reward: number;
  jobId: string;
  extraNonce: string;
  extraNonce2Size: number;
  prevHash: string;
  coinbase1: string;
  coinbase2: string;
  merkleBranches: string[];
  version: string;
  bits: string;
  time: string;
  timestamp: number;
  cleanJobs: boolean;
  received: number;
}

function isStratumJob(obj: any): obj is StratumJob {
  return obj
    && typeof obj === 'object'
    && 'pool' in obj
    && 'prevHash' in obj
    && 'height' in obj
    && 'received' in obj
    && 'version' in obj
    && 'timestamp' in obj
    && 'bits' in obj
    && 'merkleBranches' in obj
    && 'cleanJobs' in obj;
}

class StratumApi {
  private ws: WebSocket | null = null;
  private runWebsocketLoop: boolean = false;
  private startedWebsocketLoop: boolean = false;
  private websocketConnected: boolean = false;
  private jobs: Record<string, StratumJob> = {};

  public constructor() {}

  public getJobs(): Record<string, StratumJob> {
    return this.jobs;
  }

  private handleWebsocketMessage(msg: any): void {
    if (isStratumJob(msg)) {
      this.jobs[msg.pool] = msg;
      websocketHandler.handleNewStratumJob(this.jobs[msg.pool]);
    }
  }

  public async connectWebsocket(): Promise<void> {
    if (!config.STRATUM.ENABLED) {
      return;
    }
    this.runWebsocketLoop = true;
    if (this.startedWebsocketLoop) {
      return;
    }
    while (this.runWebsocketLoop) {
      this.startedWebsocketLoop = true;
      if (!this.ws) {
        this.ws = new WebSocket(`${config.STRATUM.API}`);
        this.websocketConnected = true;

        this.ws.on('open', () => {
          logger.info('Stratum websocket opened');
        });

        this.ws.on('error', (error) => {
          logger.err('Stratum websocket error: ' + error);
          this.ws = null;
          this.websocketConnected = false;
        });

        this.ws.on('close', () => {
          logger.info('Stratum websocket closed');
          this.ws = null;
          this.websocketConnected = false;
        });

        this.ws.on('message', (data, isBinary) => {
          try {
            const parsedMsg = JSON.parse((isBinary ? data : data.toString()) as string);
            this.handleWebsocketMessage(parsedMsg);
          } catch (e) {
            logger.warn('Failed to parse stratum websocket message: ' + (e instanceof Error ? e.message : e));
          }
        });
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

export default new StratumApi();