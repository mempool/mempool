import WebSocket from 'ws';

const serverWS = (
  options: string[],
  defaultWs: string,
  websocketEndpoint?: string
): WebSocket => {
  const ws = new WebSocket(websocketEndpoint || defaultWs);
  ws.on('open', function open() {
    handleMessage(ws, options);
  });
  return ws;
};

const handleMessage = (ws: WebSocket, options: string[]) => {
  ws.send(JSON.stringify({ action: 'init' }));
  ws.send(
    JSON.stringify({
      action: 'want',
      data: options,
    })
  );
};
export default serverWS;
