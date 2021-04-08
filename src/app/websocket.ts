import { WsInterface, WsInstance } from '../interfaces';
import wsClient from '../services/wsClient';
import wsServer from '../services/wsServer';

const defaultWs = 'wss://mempool.space/api/v1/ws';

export const useWebsocket = (websocketEndpoint?: string): WsInstance => {
  return {
    initClient: ({ options }: WsInterface) =>
      wsClient(options, defaultWs, websocketEndpoint),
    initServer: ({ options }: WsInterface) =>
      wsServer(options, defaultWs, websocketEndpoint),
  };
};
