const browserWS = (
  options: string[],
  defaultWs: string,
  websocketEndpoint?: string
): WebSocket => {
  const ws = new WebSocket(websocketEndpoint || defaultWs);
  ws.addEventListener('open', function open() {
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

export default browserWS;
