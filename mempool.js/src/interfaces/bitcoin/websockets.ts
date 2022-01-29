export interface WsInterface {
  options: string[];
}

import WebSocketServer from 'ws';

export interface WsInstance {
  initClient: ({ options }: WsInterface) => WebSocket;
  initServer: ({ options }: WsInterface) => WebSocketServer;
}
