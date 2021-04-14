import { WsInterface, WsInstance } from '../../interfaces/bitcoin/websockets';
import wsClient from '../../services/ws/client';
import wsServer from '../../services/ws/server';

const defaultWs = 'wss://mempool.space/liquid/api/v1/ws';

export const useWebsocket = (hostname?: string): WsInstance => {
  return {
    initClient: ({ options }: WsInterface) =>
      wsClient(options, defaultWs, hostname),
    initServer: ({ options }: WsInterface) =>
      wsServer(options, defaultWs, hostname),
  };
};
