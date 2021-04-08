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
  setInterval(function timeout() {
    ws.send(
      JSON.stringify({
        action: 'want',
        data: options,
      })
    );
  }, 500);
};
export default serverWS;
