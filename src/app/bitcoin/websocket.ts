import { WsInterface, WsInstance } from '../../interfaces/bitcoin/websockets';
import wsClient from '../../services/ws/client';
import wsServer from '../../services/ws/server';

export const useWebsocket = (hostname: string, network: string): WsInstance => {

  const wsEndpoint = `wss://${hostname}${network === 'main' ? '' : `/${network}`}/api/v1/ws`;
  return {
    initClient: ({ options }: WsInterface) =>
      wsClient(options, wsEndpoint),
    initServer: ({ options }: WsInterface) =>
      wsServer(options, wsEndpoint),
  };
};
